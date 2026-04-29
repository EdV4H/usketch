import { aabbHitTest, createResize, getBounds } from "@edv4h/usketch-shape-utils";
import {
	type CanvasPointerEvent,
	generateId,
	type PluginContext,
	type Point,
	type ShapeData,
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

/**
 * connector 専用の hit test。
 * 共通の `lineHitTest` は AABB 対角線（左上 → 右下）を線分として扱うため、
 * 左下 → 右上のような対角の connector は本来の線とは別の対角線で判定されてしまい
 * 選択できなくなる。connector は `meta.start` / `meta.end`（AABB 相対）に
 * 始点・終点を保持しているので、それを world 座標に変換して線分距離で判定する。
 */
function connectorHitTest(data: ShapeData, point: Point, tolerance = 6): boolean {
	const meta = (data.meta ?? {}) as {
		start?: { x: number; y: number };
		end?: { x: number; y: number };
	};
	const start = meta.start ?? { x: 0, y: 0 };
	const end = meta.end ?? { x: data.width, y: data.height };
	const x1 = data.x + start.x;
	const y1 = data.y + start.y;
	const x2 = data.x + end.x;
	const y2 = data.y + end.y;
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSq = dx * dx + dy * dy;
	if (lengthSq === 0) {
		return Math.hypot(point.x - x1, point.y - y1) <= tolerance;
	}
	let t = ((point.x - x1) * dx + (point.y - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));
	const nx = x1 + t * dx;
	const ny = y1 + t * dy;
	return Math.hypot(point.x - nx, point.y - ny) <= tolerance;
}

const SHAPE_HIT_TESTS: Record<string, HitTestFn> = {
	[DOMAIN_TYPES.boundedContext]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.aggregate]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.classBox]: withRotation(aabbHitTest),
	[DOMAIN_TYPES.contextMapConnector]: withRotation(connectorHitTest),
	[DOMAIN_TYPES.tacticalConnector]: withRotation(connectorHitTest),
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
			// connector は始点 / 終点を meta.start / meta.end に保持しているため、
			// 標準の AABB resize（width / height だけ更新）では line がズレる。
			// 既存の `connector` plugin と同様、専用のリサイズロジックを書くまでは
			// resize 不可にしておく（移動・回転・削除は通常通り可能）。
			const isConnector =
				subtype.type === DOMAIN_TYPES.contextMapConnector ||
				subtype.type === DOMAIN_TYPES.tacticalConnector;
			ctx.shapes.register(subtype.type, {
				render: renderer,
				getBounds,
				hitTest: hitTestFn,
				resize: createResize(
					MIN_SIZE_BY_TYPE[subtype.type]?.width ?? 1,
					MIN_SIZE_BY_TYPE[subtype.type]?.height ?? 1,
				),
				resizable: !isConnector,
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
				// connector は描画上 SVG だが、shape の bbox 自体は通常 shape と
				// 同様に正規化（width/height >= 0）しておく必要がある。
				// （shape-layer は style.width/height に shape.width/height をそのまま流すため、
				//   負値だと CSS で 0 扱いになりレンダリングが壊れる）
				// 実際の始点 / 終点は meta.start / meta.end に保存して方向を保持する。
				const sx = drawState.startX;
				const sy = drawState.startY;
				const ex = event.worldPoint.x;
				const ey = event.worldPoint.y;
				const x = Math.min(sx, ex);
				const y = Math.min(sy, ey);
				const width = Math.abs(ex - sx);
				const height = Math.abs(ey - sy);
				toolCtx.store.updateShape(drawState.shapeId, {
					x,
					y,
					width,
					height,
					meta: {
						...((toolCtx.store.getShape(drawState.shapeId)?.meta ?? {}) as Record<string, unknown>),
						start: { x: sx - x, y: sy - y },
						end: { x: ex - x, y: ey - y },
					},
				});
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
			// getShapesSorted() は zIndex 昇順（背面 → 前面）。
			// hit test は前面から拾いたいので末尾から走査して、最初の hit で抜ける。
			// （Map 順序は zIndex を反映しないため、getShapes() を素直に回すと
			//   重なり合った shape のうち背面側を選んでしまうことがある）
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

		// 選択が外れたら editing 終了。ただし select tool が pointerdown で
		// 選択を更新するタイミングは editor の blur より前なので、ここで即座に
		// DESELECTED を送ると blur 経由の COMMIT が来る前に cancelEdit が走り
		// 編集内容が捨てられる。microtask で 1 ターン遅延させ、COMMIT が先に
		// 処理されるようにする。
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
				// COMMIT / CANCEL ですでに idle に戻っていたら何もしない
				if (!stillEditingId) return;
				if (stillEditingId !== editingId) return;
				const stillSelected = ctx.store.getSelection().has(stillEditingId);
				if (stillSelected) return;
				send({ type: "DESELECTED" });
			});
		});
		cleanups.push(unsubscribe);

		// editor 外クリック時のフォーカス移動 → editor 側の onBlur が
		// COMMIT を発火する設計のため、ここでは追加の listener を登録しない。
		// （以前は global pointerdown を捕捉していたが、機能していなかったため削除）

		// ── teardown ──
		(domainDesignPlugin as { teardown?: () => void }).teardown = () => {
			for (const fn of cleanups) fn();
		};
	},

	teardown() {
		// setup() 内で動的に差し替えられる
	},
};
