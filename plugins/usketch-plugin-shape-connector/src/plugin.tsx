import {
	type AnchorType,
	createCascadeDelete,
	createConnectorTracker,
	findShapeAtPoint as findShapeAtPointGeneric,
	getAnchorPoint,
} from "@edv4h/usketch-connector-anchor";
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
import { AnchorHandleOverlay, setupAnchorHandles } from "./anchor-handle-overlay.js";
import { ConnectorLabelEditor, handleConnectorClick, setEditingLabel } from "./connector-label.js";
import { ConnectorPropertyBar } from "./connector-property-bar.js";
import { EndpointOverlay } from "./endpoint-overlay.js";
import {
	createDefaultConnector,
	getBoundsConnector,
	hitTestConnector,
	renderConnector,
	SimplifiedConnector,
} from "./shapes/connector.js";
import type { ConnectorShapeData } from "./types.js";

export type { ConnectorShapeData } from "./types.js";

function ConnectorIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20">
			<line x1="4" y1="16" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" />
			<polygon points="16,4 11,5 15,9" fill="currentColor" />
		</svg>
	);
}

// Exclude all known connector types so connector tools never anchor to another
// connector. "domain-connector" lives in the DDD plugin, but listing the string
// here (rather than importing the constant) keeps shape-connector free of any
// reverse dependency on domain-design.
const EXCLUDE_CONNECTOR = new Set(["connector", "domain-connector"]);

/** Find a shape at a point (excluding connectors and frames/groups — prefer their children) */
export function findShapeAtPoint(ctx: ToolContext | PluginContext, point: Point): ShapeData | null {
	return findShapeAtPointGeneric(ctx, point, { excludeTypes: EXCLUDE_CONNECTOR });
}

function debugFields(shape: ShapeData): Record<string, unknown> {
	const data = shape as ConnectorShapeData;
	return {
		sourceId: data.sourceId ?? null,
		targetId: data.targetId ?? null,
		sourceAnchor: data.sourceAnchor ?? null,
		targetAnchor: data.targetAnchor ?? null,
		arrowHead: data.arrowHead ?? null,
		pathType: data.pathType ?? null,
	};
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
			debugFields,
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

			const connector: ConnectorShapeData = {
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

			const updates: Partial<ConnectorShapeData> = {
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

			const finalUpdates: Partial<ConnectorShapeData> = {
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
			const finalShape: ConnectorShapeData = { ...connector, ...finalUpdates };
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

		// ── Anchor handle overlay (hover to show anchor points) ──

		ctx.layers.register({
			id: "connector-anchor-handles",
			order: 79,
			fixed: true,
			render: (renderCtx) => <AnchorHandleOverlay ctx={ctx} viewport={renderCtx.viewport} />,
		});

		const cleanupAnchorHandles = setupAnchorHandles(ctx);

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

		// ── Position tracking & cascade delete (extracted into shared package) ──

		const isConnectorType = (t: string) => t === "connector";
		const stopTracker = createConnectorTracker({ store: ctx.store, isConnectorType });
		const stopCascade = createCascadeDelete({ store: ctx.store, isConnectorType });

		(this as UsketchPlugin).teardown = () => {
			stopTracker();
			stopCascade();
			unsubLabelClick();
			unsubPointerForLabel();
			cleanupAnchorHandles();
			ctx.layers.unregister("connector-properties");
			ctx.layers.unregister("connector-endpoints");
			ctx.layers.unregister("connector-label-editor");
			ctx.layers.unregister("connector-anchor-handles");
		};
	},
};
