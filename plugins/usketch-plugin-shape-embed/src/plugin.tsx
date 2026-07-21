import {
	type BoundingBox,
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type Point,
	type ResizeHandle,
	type ShapeData,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { createServerClock, type ServerClock } from "@edv4h/usketch-sync";
import { DEFAULT_EMBED_DEFS, type EmbedDefinition, resolveEmbed } from "./embed-defs.js";
import { EMBED_ACTION_EVENT, type EmbedAction } from "./embed-events.js";
import {
	DefaultEmbedChrome,
	type EmbedChrome,
	type EmbedRuntime,
	EmbedView,
} from "./embed-view.js";
import { createEmbedUrlHandler } from "./external-content-handler.js";
import type { EmbedShapeData } from "./types.js";

export const EMBED_TYPE = "embed";
// ── Geometry ──

function getBounds(data: ShapeData): BoundingBox {
	return { x: data.x, y: data.y, width: data.width, height: data.height };
}
function hitTest(data: ShapeData, point: Point): boolean {
	return (
		point.x >= data.x &&
		point.x <= data.x + data.width &&
		point.y >= data.y &&
		point.y <= data.y + data.height
	);
}
function resize(data: ShapeData, handle: ResizeHandle, delta: Point): ShapeData {
	let { x, y, width, height } = data;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return { ...data, x, y, width: Math.max(160, width), height: Math.max(120, height) };
}
function createDefault(params: { id: string; x: number; y: number }): EmbedShapeData {
	return {
		id: params.id,
		type: EMBED_TYPE,
		x: params.x,
		y: params.y,
		width: 560,
		height: 340,
		style: { fill: "#000000", stroke: "#334155", strokeWidth: 1, opacity: 1 },
		url: "",
		isActive: false,
		syncMode: "free",
	};
}

function safeOrigin(url: string): string {
	try {
		return new URL(url).origin;
	} catch {
		return "";
	}
}
function serializeForAi(shape: ShapeData): Record<string, unknown> {
	const d = shape as EmbedShapeData;
	// Only the origin (not the full URL) to keep prompts small & avoid leaking query params.
	return d.url ? { kind: "embed", origin: safeOrigin(d.url), provider: d.provider } : {};
}

function EmbedIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
			<rect
				x="2.5"
				y="4"
				width="15"
				height="12"
				rx="2"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
			/>
			<path d="M8 8l3 2-3 2z" fill="currentColor" />
		</svg>
	);
}

// ── Plugin ──

export interface EmbedPluginOptions {
	/** Extra provider definitions (added before defaults so they can override). */
	embeds?: EmbedDefinition[];
	/** Existing server clock to reuse (e.g. the board-level one shared with Timter),
	 * so we don't spin up a second `/time` poller. Takes precedence over `apiUrl`. */
	serverClock?: ServerClock;
	/** API origin for a server clock created by this plugin when `serverClock` is
	 * not provided (playback sync). Omit → local clock. */
	apiUrl?: string;
	boardId?: string;
	userId?: string;
	/** Swap the shape's chrome (header/frame). Behavior (iframe/player) is retained
	 * as long as the custom Chrome renders its `children`. */
	components?: { Chrome?: EmbedChrome };
}

export function createEmbedShapePlugin(options: EmbedPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-embed",
		name: "埋め込み",

		setup(ctx: PluginContext) {
			const defs = [...(options.embeds ?? []), ...DEFAULT_EMBED_DEFS];
			// Reuse a provided clock (shared with other features); only create — and
			// therefore only destroy — our own when none was supplied.
			const ownClock = options.serverClock
				? null
				: createServerClock({ baseUrl: options.apiUrl ?? null });
			const serverClock = options.serverClock ?? ownClock!;
			const userId = options.userId ?? "local";
			const rt: EmbedRuntime = {
				store: ctx.store,
				serverClock,
				userId,
				defs,
				Chrome: options.components?.Chrome ?? DefaultEmbedChrome,
			};

			const onAction = (e: Event) => {
				const detail = (e as CustomEvent<EmbedAction>).detail;
				const shape = ctx.store.getShape(detail.id) as EmbedShapeData | undefined;
				if (!shape || shape.type !== EMBED_TYPE) return;
				switch (detail.action) {
					case "set-url": {
						const resolved = detail.url ? resolveEmbed(detail.url, defs) : null;
						ctx.store.updateShape(detail.id, {
							url: detail.url,
							provider: resolved?.def.id,
							playback: undefined,
						} as Partial<ShapeData>);
						break;
					}
					case "activate":
						// Select as well: the deselect watcher below turns off any active
						// embed that isn't selected, so activating without selecting would
						// be reverted instantly (e.g. clicking ▶ on an unselected embed).
						ctx.store.updateShape(detail.id, { isActive: true } as Partial<ShapeData>);
						ctx.store.setSelection([detail.id]);
						break;
					case "deactivate":
						ctx.store.updateShape(detail.id, { isActive: false } as Partial<ShapeData>);
						break;
					case "toggle-presenter": {
						const isPresenterMode = shape.syncMode === "presenter";
						const isMine = isPresenterMode && shape.presenterId === userId;
						// I hold it → release to free-for-all. Nobody holds it → I claim it.
						// Someone ELSE holds it → do nothing (can't steal presentership).
						if (isMine) {
							ctx.store.updateShape(detail.id, {
								syncMode: "free",
								presenterId: undefined,
							} as Partial<ShapeData>);
						} else if (!isPresenterMode) {
							ctx.store.updateShape(detail.id, {
								syncMode: "presenter",
								presenterId: userId,
							} as Partial<ShapeData>);
						}
						break;
					}
				}
			};
			window.addEventListener(EMBED_ACTION_EVENT, onAction);

			// Double-click a non-active embed → activate (interact). Uses canvas:pointerdown.
			let lastDown = { id: "", t: 0 };
			const offPointer = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
				let hit: EmbedShapeData | null = null;
				for (const [, s] of ctx.store.getShapes()) {
					if (s.type === EMBED_TYPE && hitTest(s, event.worldPoint)) hit = s as EmbedShapeData;
				}
				if (!hit) {
					lastDown = { id: "", t: 0 };
					return;
				}
				const t = Date.now();
				if (lastDown.id === hit.id && t - lastDown.t < 300 && !hit.isActive) {
					ctx.store.updateShape(hit.id, { isActive: true } as Partial<ShapeData>);
				}
				lastDown = { id: hit.id, t };
			});

			// Deactivate on deselect (so a moved-away embed stops capturing pointer).
			// Gated on selection changes only — running on every mutation would scan
			// all shapes on each playback-sync tick, and would also fight `activate`.
			const unsubStore = ctx.store.onMutation((event) => {
				if (event.type !== "selection:changed") return;
				const sel = ctx.store.getSelection();
				for (const [id, s] of ctx.store.getShapes()) {
					if (s.type === EMBED_TYPE && (s as EmbedShapeData).isActive && !sel.has(id)) {
						ctx.store.updateShape(id, { isActive: false } as Partial<ShapeData>);
					}
				}
			});

			ctx.shapes.register(EMBED_TYPE, {
				render: (shape) => <EmbedView data={shape as EmbedShapeData} rt={rt} />,
				getBounds,
				hitTest: withRotation(hitTest),
				resize,
				createDefault,
				renderTarget: "html",
				minSize: { width: 160, height: 120 },
				serializeForAi,
			});

			// Draw tool.
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;
			ctx.tools.register("embed-draw", {
				icon: EmbedIcon,
				cursor: "crosshair",
				order: 44,
				onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
					const id = generateId();
					drawState = { startX: event.worldPoint.x, startY: event.worldPoint.y, shapeId: id };
					const shape = createDefault({ id, x: event.worldPoint.x, y: event.worldPoint.y });
					shape.width = 0;
					shape.height = 0;
					toolCtx.store.addShape(shape);
				},
				onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
					if (!drawState) return;
					toolCtx.store.updateShape(drawState.shapeId, {
						x: Math.min(drawState.startX, event.worldPoint.x),
						y: Math.min(drawState.startY, event.worldPoint.y),
						width: Math.abs(event.worldPoint.x - drawState.startX),
						height: Math.abs(event.worldPoint.y - drawState.startY),
					});
				},
				onPointerUp(toolCtx: ToolContext) {
					if (!drawState) return;
					const shape = toolCtx.store.getShape(drawState.shapeId);
					toolCtx.store.deleteShape(drawState.shapeId);
					const def =
						shape && shape.width > 40 && shape.height > 40
							? (shape as EmbedShapeData)
							: createDefault({
									id: drawState.shapeId,
									x: drawState.startX - 280,
									y: drawState.startY - 170,
								});
					toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, def));
					toolCtx.store.setSelection([def.id]);
					drawState = null;
					toolCtx.store.resetToDefaultTool();
				},
			});

			// Paste/drop a URL → create an embed (order 0 = future handlers can win).
			const offUrl = ctx.externalContent.register(createEmbedUrlHandler(() => defs));

			return () => {
				window.removeEventListener(EMBED_ACTION_EVENT, onAction);
				offPointer();
				unsubStore();
				offUrl();
				ownClock?.destroy();
			};
		},
	};
}
