import { aabbHitTest, createResize, getBounds, lineHitTest } from "@edv4h/usketch-shape-utils";
import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type ShapeDefinition,
	type ToolContext,
	type UsketchPlugin,
	withRotation,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { renderContextMapConnector } from "./connectors/context-map.js";
import { renderTacticalConnector } from "./connectors/tactical.js";
import { createDomainEditingService, EDITABLE_DOMAIN_TYPES } from "./editor/editing-machine.js";
import { DOMAIN_SUBTYPES } from "./registry.js";
import { renderAggregate } from "./shapes/aggregate.js";
import { renderBoundedContext } from "./shapes/bounded-context.js";
import { renderClassBox } from "./shapes/class-box.js";
import { DOMAIN_TYPES } from "./types.js";

type RendererFn = ShapeDefinition["render"];
type HitTestFn = ShapeDefinition["hitTest"];

const SHAPE_RENDERERS: Record<string, RendererFn> = {
	[DOMAIN_TYPES.boundedContext]: renderBoundedContext,
	[DOMAIN_TYPES.aggregate]: renderAggregate,
	[DOMAIN_TYPES.classBox]: renderClassBox,
	[DOMAIN_TYPES.contextMapConnector]: renderContextMapConnector,
	[DOMAIN_TYPES.tacticalConnector]: renderTacticalConnector,
};

const SHAPE_HIT_TESTS: Record<string, HitTestFn> = {
	[DOMAIN_TYPES.boundedContext]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.aggregate]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.classBox]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.contextMapConnector]: withRotation(lineHitTest),
	[DOMAIN_TYPES.tacticalConnector]: withRotation(lineHitTest),
};

function DomainDrawIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<rect
				x="2"
				y="3"
				width="9"
				height="6"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.4"
				strokeDasharray="2 1.5"
			/>
			<rect x="9" y="11" width="9" height="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
			<line x1="11" y1="6" x2="9" y2="11" stroke="currentColor" strokeWidth="1.2" />
		</svg>
	);
}

const RENDER_TARGET_BY_TYPE: Record<string, "html" | "svg"> = {
	[DOMAIN_TYPES.boundedContext]: "html",
	[DOMAIN_TYPES.aggregate]: "html",
	[DOMAIN_TYPES.classBox]: "html",
	[DOMAIN_TYPES.contextMapConnector]: "svg",
	[DOMAIN_TYPES.tacticalConnector]: "svg",
};

const MIN_SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
	[DOMAIN_TYPES.boundedContext]: { width: 120, height: 80 },
	[DOMAIN_TYPES.aggregate]: { width: 80, height: 60 },
	[DOMAIN_TYPES.classBox]: { width: 100, height: 80 },
	[DOMAIN_TYPES.contextMapConnector]: { width: 1, height: 1 },
	[DOMAIN_TYPES.tacticalConnector]: { width: 1, height: 1 },
};

export const domainDesignPlugin: UsketchPlugin = {
	id: "usketch-plugin-domain-design",
	name: "ドメイン設計",

	setup(ctx: PluginContext) {
		const cleanups: Array<() => void> = [];

		// ── Shape 登録 ──
		for (const subtype of DOMAIN_SUBTYPES) {
			const renderer = SHAPE_RENDERERS[subtype.type];
			const hitTestFn = SHAPE_HIT_TESTS[subtype.type];
			if (!renderer || !hitTestFn) continue;
			ctx.shapes.register(subtype.type, {
				render: renderer,
				getBounds,
				hitTest: hitTestFn,
				resize: createResize(
					MIN_SIZE_BY_TYPE[subtype.type]?.width ?? 1,
					MIN_SIZE_BY_TYPE[subtype.type]?.height ?? 1,
				),
				createDefault: subtype.createDefault,
				renderTarget: RENDER_TARGET_BY_TYPE[subtype.type],
				minSize: MIN_SIZE_BY_TYPE[subtype.type],
			});
		}

		// ── Tool: subtype 切り替え ──
		let currentSubtype = DOMAIN_SUBTYPES[0]?.type ?? DOMAIN_TYPES.boundedContext;
		const offSubtype = ctx.events.on<{ type: string }>("domain-design:select-subtype", (data) => {
			currentSubtype = data.type;
		});
		cleanups.push(offSubtype);

		let drawState: { startX: number; startY: number; shapeId: string } | null = null;

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const subtype = DOMAIN_SUBTYPES.find((s) => s.type === currentSubtype);
			if (!subtype) return;
			const id = generateId();
			drawState = {
				startX: event.worldPoint.x,
				startY: event.worldPoint.y,
				shapeId: id,
			};
			const shape = subtype.createDefault({
				id,
				x: event.worldPoint.x,
				y: event.worldPoint.y,
			});
			shape.width = 0;
			shape.height = 0;
			toolCtx.store.addShape(shape);
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!drawState) return;
			const subtype = DOMAIN_SUBTYPES.find((s) => s.type === currentSubtype);
			if (!subtype) return;

			const isConnector =
				currentSubtype === DOMAIN_TYPES.contextMapConnector ||
				currentSubtype === DOMAIN_TYPES.tacticalConnector;

			if (isConnector) {
				// connector は (start) → (end) を x/y/width/height で表現する。
				// width / height には符号付きの差分を入れる（負値も許容）。
				const x = drawState.startX;
				const y = drawState.startY;
				const width = event.worldPoint.x - drawState.startX;
				const height = event.worldPoint.y - drawState.startY;
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			} else {
				const x = Math.min(drawState.startX, event.worldPoint.x);
				const y = Math.min(drawState.startY, event.worldPoint.y);
				const width = Math.abs(event.worldPoint.x - drawState.startX);
				const height = Math.abs(event.worldPoint.y - drawState.startY);
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			}
		}

		function onPointerUp(toolCtx: ToolContext) {
			if (!drawState) return;
			const shape = toolCtx.store.getShape(drawState.shapeId);
			const isConnector =
				shape?.type === DOMAIN_TYPES.contextMapConnector ||
				shape?.type === DOMAIN_TYPES.tacticalConnector;
			const minDim = isConnector ? 6 : 2;
			const length = isConnector
				? Math.hypot(shape?.width ?? 0, shape?.height ?? 0)
				: Math.min(Math.abs(shape?.width ?? 0), Math.abs(shape?.height ?? 0));

			if (shape && length > minDim) {
				toolCtx.store.deleteShape(drawState.shapeId);
				toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, shape));
			} else {
				toolCtx.store.deleteShape(drawState.shapeId);
			}
			drawState = null;
			toolCtx.store.setActiveToolId("select");
		}

		ctx.tools.register("domain-draw", {
			icon: DomainDrawIcon,
			cursor: "crosshair",
			shortcut: "d",
			order: 12,
			onPointerDown,
			onPointerMove,
			onPointerUp,
		});

		// ── インライン編集（state machine + custom events） ──
		const editingService = createDomainEditingService(ctx);
		const { send, matches, stop: stopMachine } = editingService;
		cleanups.push(stopMachine);

		const onCommit = (e: Event) => {
			const detail = (e as CustomEvent).detail as {
				id: string;
				nextMeta: Record<string, unknown>;
			};
			send({ type: "COMMIT", id: detail.id, nextMeta: detail.nextMeta });
		};
		const onCancel = (e: Event) => {
			const detail = (e as CustomEvent).detail as { id: string };
			send({ type: "CANCEL", id: detail.id });
		};
		window.addEventListener("usketch:domain-design:commit", onCommit);
		window.addEventListener("usketch:domain-design:cancel", onCancel);
		cleanups.push(() => window.removeEventListener("usketch:domain-design:commit", onCommit));
		cleanups.push(() => window.removeEventListener("usketch:domain-design:cancel", onCancel));

		// canvas:pointerdown でクリック・ダブルクリック判定
		const offCanvasPointer = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", (event) => {
			let hitShapeId: string | null = null;
			const point = event.worldPoint;
			const shapes = ctx.store.getShapes();
			for (const [id, shape] of shapes) {
				if (!EDITABLE_DOMAIN_TYPES.has(shape.type)) continue;
				const def: ShapeDefinition | undefined = ctx.shapes.get(shape.type);
				if (!def) continue;
				if (def.hitTest(shape, point)) {
					hitShapeId = id;
				}
			}
			send({ type: "POINTER_DOWN", shapeId: hitShapeId });
		});
		cleanups.push(offCanvasPointer);

		// 選択が外れたら editing 終了
		const unsubscribe = ctx.store.subscribe(() => {
			const editingId = editingService.editingShapeId;
			if (!editingId) return;
			const selection = ctx.store.getSelection();
			if (!selection.has(editingId)) {
				send({ type: "DESELECTED" });
			}
		});
		cleanups.push(unsubscribe);

		// editor 外クリックで commit を促す（global pointerdown）
		const onWindowPointerDown = (e: PointerEvent) => {
			if (!matches("editing")) return;
			const target = e.target instanceof Element ? e.target : (e.target as Node).parentElement;
			if (target?.closest("[contenteditable=true]")) return;
			// editor の外をクリックしたら editor の blur で COMMIT が発火する想定。
			// ここでは何もしない（editor の onBlur に任せる）。
		};
		window.addEventListener("pointerdown", onWindowPointerDown, true);
		cleanups.push(() => window.removeEventListener("pointerdown", onWindowPointerDown, true));

		// ── teardown ──
		(domainDesignPlugin as { teardown?: () => void }).teardown = () => {
			for (const fn of cleanups) fn();
		};
	},

	teardown() {
		// setup() 内で動的に差し替えられる
	},
};
