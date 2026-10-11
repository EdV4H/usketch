import { clampToShapeEdge, getDefaultControlPoint } from "@edv4h/usketch-connector-anchor";
import type { PluginContext, Point, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useSyncExternalStore } from "react";
import { isTooShortDrag, moveConnectorEnd } from "./connector-ends.js";
import {
	type EndpointDragState,
	getEndpointDrag,
	setEndpointDrag,
	subscribeEndpointDrag,
} from "./endpoint-drag-state.js";
import { findShapeAtPoint } from "./plugin.js";
import type { ConnectorShapeData } from "./types.js";

const HANDLE_RADIUS = 5;
const STROKE_COLOR = "#2680eb";

interface EndpointOverlayProps {
	ctx: PluginContext;
	viewport: Viewport;
}

export function EndpointOverlay({ ctx, viewport }: EndpointOverlayProps) {
	const selection = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getSelection(),
	);

	const activeToolId = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getActiveToolId(),
	);

	const shapes = useSyncExternalStore(
		(cb) => ctx.store.subscribe(cb),
		() => ctx.store.getShapes(),
	);

	const dragState = useSyncExternalStore(subscribeEndpointDrag, getEndpointDrag);

	if (activeToolId !== "select") return null;
	if (selection.size !== 1) return null;

	const connectorId = [...selection][0];
	const connector = shapes.get(connectorId);
	if (!connector || connector.type !== "connector") return null;

	const connectorData = connector as ConnectorShapeData;
	const sourcePoint = connectorData.sourcePoint;
	const targetPoint = connectorData.targetPoint;
	if (!sourcePoint || !targetPoint) return null;

	const controlPoint = connectorData.controlPoint;
	const pathType = connectorData.pathType ?? "straight";
	const showControlHandle = pathType === "curve";
	const cp = controlPoint ?? getDefaultControlPoint(sourcePoint, targetPoint);

	const srcScreen = worldToScreen(sourcePoint, viewport);
	const tgtScreen = worldToScreen(targetPoint, viewport);
	const cpScreen = showControlHandle ? worldToScreen(cp, viewport) : null;

	return (
		<svg
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			{/* Preview line during drag */}
			{dragState && dragState.connectorId === connectorId && (
				<DragPreview dragState={dragState} connector={connector} viewport={viewport} />
			)}

			{/* Target shape highlight during drag */}
			{dragState?.targetShapeId && (
				<TargetHighlight
					shapeId={dragState.targetShapeId}
					shapes={shapes}
					shapesDefs={ctx.shapes}
					viewport={viewport}
				/>
			)}

			{/* Control point guide line (for curve) */}
			{cpScreen && (
				<>
					<line
						x1={srcScreen.x}
						y1={srcScreen.y}
						x2={cpScreen.x}
						y2={cpScreen.y}
						stroke={STROKE_COLOR}
						strokeWidth={0.5}
						opacity={0.4}
					/>
					<line
						x1={cpScreen.x}
						y1={cpScreen.y}
						x2={tgtScreen.x}
						y2={tgtScreen.y}
						stroke={STROKE_COLOR}
						strokeWidth={0.5}
						opacity={0.4}
					/>
				</>
			)}

			{/* Source handle */}
			<EndpointHandle
				screen={srcScreen}
				endpoint="source"
				connectorId={connectorId}
				connector={connector}
				ctx={ctx}
				viewport={viewport}
				worldPoint={sourcePoint}
			/>

			{/* Target handle */}
			<EndpointHandle
				screen={tgtScreen}
				endpoint="target"
				connectorId={connectorId}
				connector={connector}
				ctx={ctx}
				viewport={viewport}
				worldPoint={targetPoint}
			/>

			{/* Control point handle (for curve) */}
			{cpScreen && (
				<EndpointHandle
					screen={cpScreen}
					endpoint="controlPoint"
					connectorId={connectorId}
					connector={connector}
					ctx={ctx}
					viewport={viewport}
					worldPoint={cp}
					isControlPoint
				/>
			)}
		</svg>
	);
}

function DragPreview({
	dragState,
	connector,
	viewport,
}: {
	dragState: EndpointDragState;
	connector: ShapeData;
	viewport: Viewport;
}) {
	const connectorData = connector as ConnectorShapeData;
	const sourcePoint = connectorData.sourcePoint as Point;
	const targetPoint = connectorData.targetPoint as Point;
	const dragScreen = worldToScreen(dragState.currentPoint, viewport);

	if (dragState.endpoint === "source") {
		const tgtScreen = worldToScreen(targetPoint, viewport);
		return (
			<line
				x1={dragScreen.x}
				y1={dragScreen.y}
				x2={tgtScreen.x}
				y2={tgtScreen.y}
				stroke={STROKE_COLOR}
				strokeWidth={1.5}
				strokeDasharray="4 3"
			/>
		);
	}
	if (dragState.endpoint === "target") {
		const srcScreen = worldToScreen(sourcePoint, viewport);
		return (
			<line
				x1={srcScreen.x}
				y1={srcScreen.y}
				x2={dragScreen.x}
				y2={dragScreen.y}
				stroke={STROKE_COLOR}
				strokeWidth={1.5}
				strokeDasharray="4 3"
			/>
		);
	}
	return null;
}

function TargetHighlight({
	shapeId,
	shapes,
	shapesDefs,
	viewport,
}: {
	shapeId: string;
	shapes: ReadonlyMap<string, ShapeData>;
	shapesDefs: PluginContext["shapes"];
	viewport: Viewport;
}) {
	const shape = shapes.get(shapeId);
	if (!shape) return null;
	const def = shapesDefs.get(shape.type);
	const bounds = def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const sx = bounds.x * viewport.zoom + viewport.x;
	const sy = bounds.y * viewport.zoom + viewport.y;
	const sw = bounds.width * viewport.zoom;
	const sh = bounds.height * viewport.zoom;
	return (
		<rect
			x={sx}
			y={sy}
			width={sw}
			height={sh}
			fill="none"
			stroke={STROKE_COLOR}
			strokeWidth={2}
			strokeDasharray="5 3"
			rx={3}
		/>
	);
}

function EndpointHandle({
	screen,
	endpoint,
	connectorId,
	connector,
	ctx,
	viewport,
	worldPoint,
	isControlPoint,
}: {
	screen: Point;
	endpoint: "source" | "target" | "controlPoint";
	connectorId: string;
	connector: ShapeData;
	ctx: PluginContext;
	viewport: Viewport;
	worldPoint: Point;
	isControlPoint?: boolean;
}) {
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();

			const svgEl = (e.currentTarget as SVGElement).ownerSVGElement;
			if (!svgEl) return;

			setEndpointDrag({
				connectorId,
				endpoint,
				currentPoint: worldPoint,
				targetShapeId: null,
			});

			// The shape this endpoint is currently connected to
			const connectorData = connector as ConnectorShapeData;
			const currentShapeId =
				endpoint === "source" ? connectorData.sourceId : connectorData.targetId;

			// Raw pointer position (drag.currentPoint is clamped while sliding).
			let pointer = worldPoint;

			const onMove = (me: PointerEvent) => {
				const wp = screenToWorld({ x: me.clientX, y: me.clientY }, viewport);
				pointer = wp;

				if (endpoint === "controlPoint") {
					setEndpointDrag({
						connectorId,
						endpoint,
						currentPoint: wp,
						targetShapeId: null,
					});
					// Live-update the curve so the bend (and the handle, which reads the
					// shape's controlPoint) follows the pointer during the drag instead of
					// only snapping into place on release. The single undoable command is
					// still committed once in onUp (before = original captured at
					// pointerdown, after = final position).
					ctx.store.updateShape(connectorId, {
						controlPoint: wp,
						controlPointAuto: false,
					} as Partial<ConnectorShapeData>);
					return;
				}

				// Check if we're over the same shape (slide anchor) or a different one (reconnect)
				const hoverShape = findShapeAtPoint(ctx, wp);
				const otherEndShapeId =
					endpoint === "source" ? connectorData.targetId : connectorData.sourceId;

				if (hoverShape && hoverShape.id === currentShapeId) {
					// Sliding along current shape's edge
					const edgePoint = clampToShapeEdge(hoverShape, wp);
					setEndpointDrag({
						connectorId,
						endpoint,
						currentPoint: edgePoint,
						targetShapeId: null,
					});
				} else {
					setEndpointDrag({
						connectorId,
						endpoint,
						currentPoint: wp,
						targetShapeId: hoverShape && hoverShape.id !== otherEndShapeId ? hoverShape.id : null,
					});
				}
			};

			const onUp = () => {
				const drag = getEndpointDrag();
				if (drag && drag.connectorId === connectorId) {
					if (drag.endpoint === "controlPoint") {
						const before: Partial<ConnectorShapeData> = {
							controlPoint: connectorData.controlPoint,
							controlPointAuto: connectorData.controlPointAuto,
						};
						const after: Partial<ConnectorShapeData> = {
							controlPoint: drag.currentPoint,
							controlPointAuto: false,
						};
						ctx.commands.execute(
							createBatchUpdateShapesCommand(ctx.store, [
								{ id: connectorId, from: before, to: after },
							]),
						);
					} else {
						commitEndpointDrop(ctx, connectorId, drag.endpoint, worldPoint, pointer, viewport);
					}
				}
				setEndpointDrag(null);
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			};

			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		},
		[connectorId, connector, endpoint, worldPoint, viewport, ctx],
	);

	const r = isControlPoint ? HANDLE_RADIUS - 1 : HANDLE_RADIUS;
	const hitR = r + 4; // Larger invisible hit area

	return (
		<g onPointerDown={handlePointerDown} style={{ cursor: "grab", pointerEvents: "auto" }}>
			{/* Invisible hit area */}
			<circle cx={screen.x} cy={screen.y} r={hitR} fill="transparent" />
			{/* Visible handle */}
			<circle
				cx={screen.x}
				cy={screen.y}
				r={r}
				fill={isControlPoint ? STROKE_COLOR : "white"}
				stroke={STROKE_COLOR}
				strokeWidth={1.5}
			/>
		</g>
	);
}

/**
 * Commit a dragged endpoint (see {@link moveConnectorEnd}): connect, slide,
 * detach to a free end, or move a free end. A click without real movement and
 * a drop onto the shape the other end is attached to change nothing.
 */
function commitEndpointDrop(
	ctx: PluginContext,
	connectorId: string,
	endpoint: "source" | "target",
	startPoint: Point,
	dropPoint: Point,
	viewport: Viewport,
) {
	const connector = ctx.store.getShape(connectorId) as ConnectorShapeData | undefined;
	if (!connector) return;
	if (isTooShortDrag(startPoint, dropPoint, viewport.zoom)) return;
	const dropShape = findShapeAtPoint(ctx, dropPoint);
	const otherId = endpoint === "source" ? connector.targetId : connector.sourceId;
	if (dropShape && dropShape.id === otherId) return;

	const to = moveConnectorEnd(connector, endpoint, { shape: dropShape, point: dropPoint }, (id) =>
		ctx.store.getShape(id),
	);
	const from = Object.fromEntries(
		Object.keys(to).map((key) => [key, connector[key as keyof ConnectorShapeData]]),
	) as Partial<ConnectorShapeData>;
	ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, [{ id: connectorId, from, to }]));
}

function worldToScreen(point: Point, viewport: Viewport): Point {
	return {
		x: point.x * viewport.zoom + viewport.x,
		y: point.y * viewport.zoom + viewport.y,
	};
}

function screenToWorld(point: Point, viewport: Viewport): Point {
	return {
		x: (point.x - viewport.x) / viewport.zoom,
		y: (point.y - viewport.y) / viewport.zoom,
	};
}
