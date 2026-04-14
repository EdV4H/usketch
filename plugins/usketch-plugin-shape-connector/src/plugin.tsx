import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	ShapeData,
	ToolContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { type AnchorType, getAnchorPoint } from "./anchor-utils.js";
import { ConnectorLabelEditor, handleConnectorClick, setEditingLabel } from "./connector-label.js";
import { ConnectorPropertyBar } from "./connector-property-bar.js";
import { EndpointOverlay } from "./endpoint-overlay.js";
import { getDefaultControlPoint } from "./path-utils.js";
import {
	createDefaultConnector,
	getBoundsConnector,
	hitTestConnector,
	renderConnector,
	SimplifiedConnector,
} from "./shapes/connector.js";

function ConnectorIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="16,4 11,5 15,9" fill="currentColor" />
		</svg>
	);
}

/** Find a shape at a point (excluding connectors and frames/groups — prefer their children) */
export function findShapeAtPoint(ctx: ToolContext | PluginContext, point: Point): ShapeData | null {
	const shapes = ctx.store.getShapes();
	const entries = [...shapes.entries()].reverse();
	let fallbackContainer: ShapeData | null = null;
	for (const [, data] of entries) {
		if (data.type === "connector") continue;
		const def = ctx.shapes.get(data.type);
		if (!def?.hitTest(data, point)) continue;
		if (data.type === "frame" || data.type === "group") {
			if (!fallbackContainer) fallbackContainer = data;
			continue;
		}
		return data;
	}
	return fallbackContainer;
}

export const connectorPlugin: UsketchPlugin = {
	id: "usketch-plugin-shape-connector",
	name: "コネクタ",

	setup(ctx: PluginContext) {
		// Register connector shape
		ctx.shapes.register("connector", {
			render: renderConnector,
			getBounds: getBoundsConnector,
			hitTest: hitTestConnector,
			resize: (data) => ({ ...data }),
			createDefault: createDefaultConnector,
			renderTarget: "svg",
			resizable: false,
			simplifiedComponent: SimplifiedConnector,
		});

		// ── Drawing tool ──

		let drawState: {
			connectorId: string;
			sourceShape: ShapeData;
			sourceAnchor: AnchorType;
		} | null = null;

		function onPointerDown(toolCtx: ToolContext, event: CanvasPointerEvent) {
			const sourceShape = findShapeAtPoint(toolCtx, event.worldPoint);
			if (!sourceShape) return;

			const id = generateId();
			const sourceAnchor: AnchorType = "auto";
			const sourcePoint = getAnchorPoint(sourceShape, sourceAnchor, event.worldPoint);

			const connector: ShapeData = {
				...createDefaultConnector({ id, x: sourcePoint.x, y: sourcePoint.y }),
				sourceId: sourceShape.id,
				targetId: undefined,
				sourceAnchor,
				targetAnchor: "auto",
				sourcePoint,
				targetPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
				style: { ...toolCtx.store.getStyleSettings(), fill: "transparent" },
			};

			toolCtx.store.addShape(connector);
			drawState = { connectorId: id, sourceShape, sourceAnchor };
		}

		function onPointerMove(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!drawState) return;

			const targetShape = findShapeAtPoint(toolCtx, event.worldPoint);
			const targetPoint = event.worldPoint;

			const sourcePoint = getAnchorPoint(
				drawState.sourceShape,
				drawState.sourceAnchor,
				targetPoint,
			);

			const updates: Partial<ShapeData> = {
				sourcePoint,
				targetPoint: targetShape ? getAnchorPoint(targetShape, "auto", sourcePoint) : targetPoint,
			};

			const sp = updates.sourcePoint as Point;
			const tp = updates.targetPoint as Point;
			updates.x = Math.min(sp.x, tp.x);
			updates.y = Math.min(sp.y, tp.y);
			updates.width = Math.abs(tp.x - sp.x);
			updates.height = Math.abs(tp.y - sp.y);

			toolCtx.store.updateShape(drawState.connectorId, updates);
		}

		function onPointerUp(toolCtx: ToolContext, event: CanvasPointerEvent) {
			if (!drawState) return;

			const targetShape = findShapeAtPoint(toolCtx, event.worldPoint);
			const connector = toolCtx.store.getShape(drawState.connectorId);

			if (!connector || !targetShape || targetShape.id === drawState.sourceShape.id) {
				toolCtx.store.deleteShape(drawState.connectorId);
				drawState = null;
				return;
			}

			const sourcePoint = getAnchorPoint(drawState.sourceShape, drawState.sourceAnchor, {
				x: targetShape.x + targetShape.width / 2,
				y: targetShape.y + targetShape.height / 2,
			});
			const targetPoint = getAnchorPoint(targetShape, "auto", sourcePoint);

			const finalUpdates: Partial<ShapeData> = {
				targetId: targetShape.id,
				targetAnchor: "auto",
				sourcePoint,
				targetPoint,
				x: Math.min(sourcePoint.x, targetPoint.x),
				y: Math.min(sourcePoint.y, targetPoint.y),
				width: Math.abs(targetPoint.x - sourcePoint.x),
				height: Math.abs(targetPoint.y - sourcePoint.y),
			};

			toolCtx.store.deleteShape(drawState.connectorId);
			const finalShape: ShapeData = { ...connector, ...finalUpdates };
			toolCtx.commands.execute(createAddShapeCommand(toolCtx.store, finalShape));

			drawState = null;
			toolCtx.store.setActiveToolId("select");
		}

		ctx.tools.register("connector-draw", {
			icon: ConnectorIcon,
			cursor: "crosshair",
			shortcut: "l",
			order: 12,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onDeactivate() {
				if (drawState) {
					ctx.store.deleteShape(drawState.connectorId);
					drawState = null;
				}
			},
		});

		// ── Connector property bar (Phase 4) ──

		ctx.layers.register({
			id: "connector-properties",
			order: 82,
			fixed: true,
			render: () => <ConnectorPropertyBar />,
		});

		// ── Endpoint overlay (Phase 5) ──

		ctx.layers.register({
			id: "connector-endpoints",
			order: 81,
			fixed: true,
			render: (renderCtx) => <EndpointOverlay ctx={ctx} viewport={renderCtx.viewport} />,
		});

		// ── Label editor overlay (Phase 6) ──

		ctx.layers.register({
			id: "connector-label-editor",
			order: 83,
			fixed: true,
			render: (renderCtx) => <ConnectorLabelEditor ctx={ctx} viewport={renderCtx.viewport} />,
		});

		// Double-click detection for label editing
		const unsubLabelClick = ctx.store.onMutation((event) => {
			if (event.type !== "selection:changed") return;
			// Clear label editing when selection changes
			setEditingLabel(null);
		});

		// Listen for pointer events on connectors for double-click
		const unsubPointerForLabel = ctx.events.on<{ shapeId: string }>(
			"shape:clicked",
			({ shapeId }) => {
				const shape = ctx.store.getShape(shapeId);
				if (shape?.type === "connector") {
					handleConnectorClick(shapeId);
				}
			},
		);

		// ── Position tracking: update connectors when source/target shapes move ──

		const connectorIndex = new Map<string, Set<string>>();

		function rebuildIndex() {
			connectorIndex.clear();
			for (const [id, shape] of ctx.store.getShapes()) {
				if (shape.type !== "connector") continue;
				const src = shape.sourceId as string | undefined;
				const tgt = shape.targetId as string | undefined;
				if (src) {
					if (!connectorIndex.has(src)) connectorIndex.set(src, new Set());
					connectorIndex.get(src)?.add(id);
				}
				if (tgt) {
					if (!connectorIndex.has(tgt)) connectorIndex.set(tgt, new Set());
					connectorIndex.get(tgt)?.add(id);
				}
			}
		}

		const unsubIndex = ctx.store.onMutation((event) => {
			if (event.type === "shape:added" || event.type === "shape:removed") {
				rebuildIndex();
			}
		});
		rebuildIndex();

		const unsubMove = ctx.store.onMutation((event) => {
			if (event.type !== "shape:updated") return;
			const payload = event.payload as { id: string } | undefined;
			if (!payload?.id) return;

			const connIds = connectorIndex.get(payload.id);
			if (!connIds || connIds.size === 0) return;

			for (const connId of connIds) {
				const conn = ctx.store.getShape(connId);
				if (!conn) continue;
				const sourceId = conn.sourceId as string | undefined;
				const targetId = conn.targetId as string | undefined;
				if (!sourceId || !targetId) continue;

				const source = ctx.store.getShape(sourceId);
				const target = ctx.store.getShape(targetId);
				if (!source || !target) continue;

				const sourceAnchor = (conn.sourceAnchor as AnchorType) ?? "auto";
				const targetAnchor = (conn.targetAnchor as AnchorType) ?? "auto";

				const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
				const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };

				const sourcePoint = getAnchorPoint(source, sourceAnchor, targetCenter);
				const targetPoint = getAnchorPoint(target, targetAnchor, sourceCenter);

				const updates: Partial<ShapeData> = {
					sourcePoint,
					targetPoint,
					x: Math.min(sourcePoint.x, targetPoint.x),
					y: Math.min(sourcePoint.y, targetPoint.y),
					width: Math.abs(targetPoint.x - sourcePoint.x),
					height: Math.abs(targetPoint.y - sourcePoint.y),
				};

				// Update control point if auto-calculated
				if (conn.controlPointAuto && conn.pathType === "curve") {
					updates.controlPoint = getDefaultControlPoint(sourcePoint, targetPoint);
				}

				ctx.store.updateShape(connId, updates);
			}
		});

		// ── Cascade delete ──

		const unsubDelete = ctx.store.onMutation((event) => {
			if (event.type !== "shape:removed") return;
			const payload = event.payload as { id: string } | undefined;
			if (!payload?.id) return;

			const shapes = ctx.store.getShapes();
			const toDelete: string[] = [];
			for (const [id, shape] of shapes) {
				if (
					shape.type === "connector" &&
					(shape.sourceId === payload.id || shape.targetId === payload.id)
				) {
					toDelete.push(id);
				}
			}
			for (const id of toDelete) {
				ctx.store.deleteShape(id);
			}
		});

		(this as UsketchPlugin).teardown = () => {
			unsubIndex();
			unsubMove();
			unsubDelete();
			unsubLabelClick();
			unsubPointerForLabel();
			ctx.layers.unregister("connector-properties");
			ctx.layers.unregister("connector-endpoints");
			ctx.layers.unregister("connector-label-editor");
		};
	},
};
