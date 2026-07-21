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
import { useEffect, useRef, useState } from "react";
import {
	DEFAULT_EMBED_DEFS,
	type EmbedDefinition,
	type ResolvedEmbed,
	resolveEmbed,
} from "./embed-defs.js";
import { createEmbedUrlHandler } from "./external-content-handler.js";
import { needsCorrection, playbackFrom, projectTime } from "./playback.js";
import { createYouTubePlayer, type EmbedPlayer } from "./players/youtube.js";
import type { EmbedShapeData } from "./types.js";

export const EMBED_TYPE = "embed";
const ACTION_EVENT = "usketch:embed-action";

/** Per-plugin-instance runtime, passed into the shape view as a prop (no globals,
 * so multiple boards / StrictMode remounts don't clobber each other). */
interface EmbedRuntime {
	store: PluginContext["store"];
	serverClock: ServerClock;
	userId: string;
	defs: EmbedDefinition[];
	Chrome: EmbedChrome;
}

type Action =
	| { id: string; action: "set-url"; url: string }
	| { id: string; action: "activate" | "deactivate" | "toggle-presenter" };

const emit = (detail: Action) => window.dispatchEvent(new CustomEvent(ACTION_EVENT, { detail }));

const canControl = (data: EmbedShapeData, userId: string): boolean =>
	data.syncMode !== "presenter" || data.presenterId === userId;

// ── View ──

const btn: React.CSSProperties = {
	border: "none",
	background: "rgba(255,255,255,0.15)",
	color: "#fff",
	cursor: "pointer",
	fontSize: 12,
	lineHeight: 1,
	padding: "3px 7px",
	borderRadius: 5,
	pointerEvents: "auto",
};
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function EmbedView({ data, rt }: { data: EmbedShapeData; rt: EmbedRuntime }) {
	const resolved = data.url ? resolveEmbed(data.url, rt.defs) : null;
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const playerRef = useRef<EmbedPlayer | null>(null);
	const playbackRef = useRef(data.playback);
	playbackRef.current = data.playback;
	const [urlDraft, setUrlDraft] = useState("");

	const syncable = resolved?.def.syncable === true;

	// Create the synced player when a syncable iframe mounts.
	// biome-ignore lint/correctness/useExhaustiveDependencies: recreate only on shape/embed change
	useEffect(() => {
		if (!syncable || !iframeRef.current) return;
		const player = createYouTubePlayer(iframeRef.current);
		playerRef.current = player;
		player.onUserAction(() => {
			const cur = rt.store.getShape(data.id) as EmbedShapeData | undefined;
			if (!cur || !canControl(cur, rt.userId)) return;
			const st = player.getState();
			if (!st) return;
			// Ignore state changes that merely converge to the already-synced state —
			// that's our own applied correction echoing back, not a genuine user
			// action — otherwise followers would re-broadcast and oscillate.
			const pb = playbackRef.current;
			if (pb && !needsCorrection(pb, rt.serverClock.now(), st)) return;
			rt.store.updateShape(data.id, {
				playback: playbackFrom(st, rt.serverClock.now(), rt.userId),
			} as Partial<ShapeData>);
		});
		return () => {
			player.destroy();
			playerRef.current = null;
		};
	}, [syncable, data.id, resolved?.embedUrl]);

	// Drift-correct the local player toward the synced playback state.
	useEffect(() => {
		if (!syncable) return;
		const iv = setInterval(() => {
			const player = playerRef.current;
			const pb = playbackRef.current;
			if (!player || !pb) return;
			const st = player.getState();
			if (!st || !needsCorrection(pb, rt.serverClock.now(), st)) return;
			const target = projectTime(pb, rt.serverClock.now());
			if (Math.abs(target - st.time) > 0.7) player.seek(target);
			if (pb.playing && !st.playing) player.play();
			else if (!pb.playing && st.playing) player.pause();
		}, 1000);
		return () => clearInterval(iv);
	}, [syncable, rt]);

	const active = data.isActive === true;
	const isPresenter = data.syncMode === "presenter";
	const iAmPresenter = data.presenterId === rt.userId;
	const Chrome = rt.Chrome;

	// Plugin-owned body (iframe keeps the sync player ref; a custom Chrome must
	// render {children} for playback sync to work).
	const body = resolved ? (
		<div style={{ width: "100%", height: "100%", position: "relative", background: "#000" }}>
			<iframe
				ref={iframeRef}
				id={`usketch-embed-${data.id}`}
				src={resolved.embedUrl}
				title={resolved.def.title}
				sandbox={resolved.def.sandbox}
				allow={resolved.def.allow}
				referrerPolicy="strict-origin-when-cross-origin"
				style={{
					width: "100%",
					height: "100%",
					border: "none",
					display: "block",
					pointerEvents: active ? "auto" : "none",
				}}
			/>
			{!active && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						display: "flex",
						alignItems: "flex-end",
						justifyContent: "center",
						paddingBottom: 8,
						pointerEvents: "none",
					}}
				>
					<span
						style={{
							fontSize: 11,
							color: "#fff",
							background: "rgba(0,0,0,0.5)",
							padding: "2px 8px",
							borderRadius: 10,
						}}
					>
						▶ で操作
					</span>
				</div>
			)}
		</div>
	) : (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				padding: 16,
				background: "#f8fafc",
			}}
		>
			<div style={{ fontSize: 13, color: "#64748b" }}>🔗 URL を貼り付けて埋め込み</div>
			<input
				type="url"
				placeholder="https://www.youtube.com/watch?v=…"
				value={urlDraft}
				onChange={(e) => setUrlDraft(e.target.value)}
				onPointerDown={stop}
				onKeyDown={(e) => {
					e.stopPropagation();
					if (e.key === "Enter" && urlDraft.trim())
						emit({ id: data.id, action: "set-url", url: urlDraft.trim() });
				}}
				onBlur={() =>
					urlDraft.trim() && emit({ id: data.id, action: "set-url", url: urlDraft.trim() })
				}
				style={{
					width: "90%",
					padding: "6px 8px",
					fontSize: 13,
					borderRadius: 6,
					border: "1px solid #cbd5e1",
					pointerEvents: "auto",
				}}
			/>
		</div>
	);

	return (
		<Chrome
			data={data}
			resolved={resolved}
			active={active}
			syncable={syncable}
			isPresenter={isPresenter}
			iAmPresenter={iAmPresenter}
			onSetUrl={(url) => emit({ id: data.id, action: "set-url", url })}
			onActivate={() => emit({ id: data.id, action: "activate" })}
			onDeactivate={() => emit({ id: data.id, action: "deactivate" })}
			onTogglePresenter={() => emit({ id: data.id, action: "toggle-presenter" })}
		>
			{body}
		</Chrome>
	);
}

// ── Default chrome (overridable via plugin `components.Chrome`) ──

export interface EmbedChromeProps {
	data: EmbedShapeData;
	resolved: ResolvedEmbed | null;
	active: boolean;
	syncable: boolean;
	isPresenter: boolean;
	iAmPresenter: boolean;
	/** Pass "" to clear/re-edit the URL. */
	onSetUrl: (url: string) => void;
	onActivate: () => void;
	onDeactivate: () => void;
	onTogglePresenter: () => void;
	/** Plugin-owned body (iframe / URL input). Must be rendered for sync to work. */
	children: React.ReactNode;
}
export type EmbedChrome = (props: EmbedChromeProps) => React.ReactElement;

export function DefaultEmbedChrome(p: EmbedChromeProps) {
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				background: "#000",
				border: `${p.data.style.strokeWidth}px solid ${p.data.style.stroke}`,
				borderRadius: 8,
				overflow: "hidden",
				fontFamily: "system-ui, sans-serif",
				pointerEvents: "none",
				userSelect: "none",
			}}
		>
			<div
				style={{
					height: 28,
					flex: "0 0 auto",
					display: "flex",
					alignItems: "center",
					gap: 6,
					padding: "0 6px",
					background: "#111827",
					color: "#e5e7eb",
				}}
			>
				<span
					style={{
						flex: 1,
						fontSize: 11,
						fontWeight: 600,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{p.resolved?.def.title ?? "埋め込み"}
				</span>
				{p.resolved && p.syncable && (
					<button
						type="button"
						title={p.isPresenter ? "プレゼンター解除（全員操作可）" : "プレゼンターにする"}
						style={{ ...btn, background: p.iAmPresenter ? "#7c3aed" : btn.background }}
						onPointerDown={stop}
						onClick={(e) => (stop(e), p.onTogglePresenter())}
					>
						{p.isPresenter ? "🔒" : "🆓"}
					</button>
				)}
				{p.resolved && (
					<button
						type="button"
						title="URL を変更"
						style={btn}
						onPointerDown={stop}
						onClick={(e) => (stop(e), p.onSetUrl(""))}
					>
						🔗
					</button>
				)}
				{p.resolved && (
					<button
						type="button"
						title={p.active ? "操作を終了" : "操作する"}
						style={btn}
						onPointerDown={stop}
						onClick={(e) => (stop(e), p.active ? p.onDeactivate() : p.onActivate())}
					>
						{p.active ? "✕" : "▶"}
					</button>
				)}
			</div>
			<div style={{ flex: 1, minHeight: 0 }}>{p.children}</div>
		</div>
	);
}

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
	/** API origin for the shared server clock (playback sync). Omit → local clock. */
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
			const serverClock = createServerClock({ baseUrl: options.apiUrl ?? null });
			const userId = options.userId ?? "local";
			const rt: EmbedRuntime = {
				store: ctx.store,
				serverClock,
				userId,
				defs,
				Chrome: options.components?.Chrome ?? DefaultEmbedChrome,
			};

			const onAction = (e: Event) => {
				const detail = (e as CustomEvent<Action>).detail;
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
			window.addEventListener(ACTION_EVENT, onAction);

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
				window.removeEventListener(ACTION_EVENT, onAction);
				offPointer();
				unsubStore();
				offUrl();
				serverClock.destroy();
			};
		},
	};
}
