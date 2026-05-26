import {
	createCascadeDelete,
	createConnectorTracker,
	getBoundsConnector,
	hitTestConnector,
} from "@edv4h/usketch-connector-anchor";
import { aabbHitTest, createResize, getBounds } from "@edv4h/usketch-shape-utils";
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
import { createDefaultDomainConnector } from "./connectors/connector-shape.js";
import {
	createDomainConnectorDrawTool,
	type DomainConnectorDrawTool,
} from "./connectors/draw-tool.js";
import { renderDomainConnector } from "./connectors/render-domain-connector.js";
import { createDomainEditingService, EDITABLE_DOMAIN_TYPES } from "./editor/editing-machine.js";
import { DomainConnectorPropertyBar } from "./property-bar/domain-connector-bar.js";
import { DOMAIN_SUBTYPES } from "./registry.js";
import { renderAggregate } from "./shapes/aggregate.js";
import { renderBoundedContext } from "./shapes/bounded-context.js";
import { renderClassBox } from "./shapes/class-box.js";
import { type ContextMapRelation, DOMAIN_TYPES } from "./types.js";

type RendererFn = ShapeDefinition["render"];
type HitTestFn = ShapeDefinition["hitTest"];

// Renderer / hitTest mappings for the **shape** subtypes (containers).
// The connector subtype is registered separately because it shares the
// hit-test / bounds logic from `@edv4h/usketch-connector-anchor`.
const SHAPE_RENDERERS: Record<string, RendererFn> = {
	[DOMAIN_TYPES.boundedContext]: renderBoundedContext,
	[DOMAIN_TYPES.aggregate]: renderAggregate,
	[DOMAIN_TYPES.classBox]: renderClassBox,
};

const SHAPE_HIT_TESTS: Record<string, HitTestFn> = {
	[DOMAIN_TYPES.boundedContext]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.aggregate]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.classBox]: withRotation(aabbHitTest),
};

const RENDER_TARGET_BY_TYPE: Record<string, "html" | "svg"> = {
	[DOMAIN_TYPES.boundedContext]: "html",
	[DOMAIN_TYPES.aggregate]: "html",
	[DOMAIN_TYPES.classBox]: "html",
};

const MIN_SIZE_BY_TYPE: Record<string, { width: number; height: number }> = {
	[DOMAIN_TYPES.boundedContext]: { width: 120, height: 80 },
	[DOMAIN_TYPES.aggregate]: { width: 80, height: 60 },
	[DOMAIN_TYPES.classBox]: { width: 100, height: 80 },
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

export function createDomainDesignPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-domain-design",
		name: "ドメイン設計",

		setup(ctx: PluginContext) {
			const cleanups: Array<() => void> = [];

			// ── Container shape 登録 (BoundedContext / Aggregate / ClassBox) ──
			for (const subtype of DOMAIN_SUBTYPES) {
				if (subtype.kind !== "shape") continue;
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

			// ── DDD Connector shape 登録 ──
			// Anchor / hit-test / bounds は `@edv4h/usketch-connector-anchor` のロジックを直接利用。
			// renderer のみ DDD 専用 (relation badge / 矢頭 / multiplicity を上書き)。
			// `createDefault` は draw tool 以外のパス (AI copilot 等が
			// `ctx.shapes.get(type).createDefault(...)` を呼ぶケース) でも有効な
			// `DomainConnectorShape` を返すよう、専用ファクトリを再利用する。
			ctx.shapes.register(DOMAIN_TYPES.connector, {
				render: renderDomainConnector,
				getBounds: getBoundsConnector,
				hitTest: hitTestConnector,
				resize: (data) => ({ ...data }),
				resizable: false,
				createDefault: ({ id, x, y }) =>
					createDefaultDomainConnector({
						id,
						x,
						y,
						domainKind: "context-map",
						relation: "customer-supplier",
					}),
				renderTarget: "svg",
			});

			// ── Connector tracking & cascade delete ──
			const isDomainConnectorType = (t: string) => t === DOMAIN_TYPES.connector;
			const stopTracker = createConnectorTracker({
				store: ctx.store,
				isConnectorType: isDomainConnectorType,
			});
			const stopCascade = createCascadeDelete({
				store: ctx.store,
				isConnectorType: isDomainConnectorType,
			});
			cleanups.push(stopTracker, stopCascade);

			// ── DDD connector property bar ──
			// shape-connector の `connector-properties` (order 82) のすぐ上に積む。
			// 同時に表示されることはない (それぞれ自分の type のときだけ render される)
			// が、order 値を分けておくことでレイヤーリストでの並びが安定する。
			ctx.layers.register({
				id: "domain-connector-properties",
				order: 84,
				fixed: true,
				render: () => <DomainConnectorPropertyBar />,
			});
			cleanups.push(() => ctx.layers.unregister("domain-connector-properties"));

			// ── Tool: subtype 切り替え ──
			let currentSubtype = DOMAIN_SUBTYPES[0]?.type ?? DOMAIN_TYPES.boundedContext;
			const offSubtype = ctx.events.on<{ type: string }>("domain-design:select-subtype", (data) => {
				currentSubtype = data.type;
			});
			cleanups.push(offSubtype);

			// Connector draw tool（subtype 切替で domainKind / relation が変わる）
			const connectorTool: DomainConnectorDrawTool = createDomainConnectorDrawTool(() => {
				const subtype = DOMAIN_SUBTYPES.find((s) => s.type === currentSubtype);
				if (subtype?.kind === "connector") {
					return { domainKind: subtype.domainKind, relation: subtype.defaultRelation };
				}
				return { domainKind: "context-map", relation: "customer-supplier" as ContextMapRelation };
			});

			// Container shape draw 用の state（drag で rect を生成）
			let drawState: { startX: number; startY: number; shapeId: string } | null = null;

			function isConnectorSubtype() {
				const subtype = DOMAIN_SUBTYPES.find((s) => s.type === currentSubtype);
				return subtype?.kind === "connector";
			}

			function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (isConnectorSubtype()) {
					connectorTool.onPointerDown(toolCtx, event);
					return;
				}
				const subtype = DOMAIN_SUBTYPES.find((s) => s.type === currentSubtype);
				if (!subtype || subtype.kind !== "shape") return;
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
				if (isConnectorSubtype()) {
					connectorTool.onPointerMove(toolCtx, event);
					return;
				}
				if (!drawState) return;
				const x = Math.min(drawState.startX, event.worldPoint.x);
				const y = Math.min(drawState.startY, event.worldPoint.y);
				const width = Math.abs(event.worldPoint.x - drawState.startX);
				const height = Math.abs(event.worldPoint.y - drawState.startY);
				toolCtx.store.updateShape(drawState.shapeId, { x, y, width, height });
			}

			function onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent) {
				if (isConnectorSubtype()) {
					connectorTool.onPointerUp(toolCtx, event);
					return;
				}
				if (!drawState) return;
				const shape = toolCtx.store.getShape(drawState.shapeId);
				const minDim = 2;
				const length = Math.min(Math.abs(shape?.width ?? 0), Math.abs(shape?.height ?? 0));
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
				onDeactivate(toolCtx: ToolContext) {
					connectorTool.onDeactivate(toolCtx);
					if (drawState) {
						toolCtx.store.deleteShape(drawState.shapeId);
						drawState = null;
					}
				},
			});

			// ── インライン編集（state machine + custom events） ──
			const editingService = createDomainEditingService(ctx);
			const { send, stop: stopMachine } = editingService;
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
				const sorted = ctx.store.getShapesSorted();
				for (let i = sorted.length - 1; i >= 0; i--) {
					const shape = sorted[i];
					if (!shape) continue;
					if (!EDITABLE_DOMAIN_TYPES.has(shape.type)) continue;
					const def: ShapeDefinition | undefined = ctx.shapes.get(shape.type);
					if (!def) continue;
					if (def.hitTest(shape, point)) {
						hitShapeId = shape.id;
						break;
					}
				}
				send({ type: "POINTER_DOWN", shapeId: hitShapeId });
			});
			cleanups.push(offCanvasPointer);

			// 選択が外れたら editing 終了。queueMicrotask で 1 ターン遅延させ、
			// editor の onBlur 経由の COMMIT が先に処理されるのを待つ。
			let pendingDeselectedShapeId: string | null = null;
			const unsubscribe = ctx.store.subscribe(() => {
				const editingId = editingService.editingShapeId;
				if (!editingId) return;
				const selection = ctx.store.getSelection();
				if (selection.has(editingId)) return;
				if (pendingDeselectedShapeId === editingId) return;
				pendingDeselectedShapeId = editingId;
				queueMicrotask(() => {
					const stillEditingId = editingService.editingShapeId;
					pendingDeselectedShapeId = null;
					if (!stillEditingId) return;
					if (stillEditingId !== editingId) return;
					const stillSelected = ctx.store.getSelection().has(stillEditingId);
					if (stillSelected) return;
					send({ type: "DESELECTED" });
				});
			});
			cleanups.push(unsubscribe);

			// ── teardown ──
			return () => {
				for (const fn of cleanups) fn();
			};
		},
	};
}
