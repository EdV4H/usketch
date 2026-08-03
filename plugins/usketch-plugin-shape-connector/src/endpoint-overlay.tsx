import {
	clampToShapeEdge,
	getAnchorPoint,
	getDefaultControlPoint,
} from "@edv4h/usketch-connector-anchor";
import type { PluginContext, Point, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { rotatePoint, safeRotation, unrotatePoint } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useSyncExternalStore } from "react";
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

	// The connector body is rendered rotated (CSS `rotate(rotation)` around the
	// shape's bbox center — see connector.tsx / dom-shape-layer). Endpoint /
	// control points are stored un-rotated, so rotate them into the displayed
	// position before projecting to screen, or the handles detach from the line.
	const frame = connectorRotationFrame(connector);
	const toScreen = (p: Point) => worldToScreen(applyRotation(p, frame), viewport);
	const srcScreen = toScreen(sourcePoint);
	const tgtScreen = toScreen(targetPoint);
	const cpScreen = showControlHandle ? toScreen(cp) : null;

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
	// `currentPoint` is stored un-rotated (see EndpointHandle onMove); rotate all
	// points into the connector's displayed frame so the preview tracks the line.
	const frame = connectorRotationFrame(connector);
	const dragScreen = worldToScreen(applyRotation(dragState.currentPoint, frame), viewport);

	if (dragState.endpoint === "source") {
		const tgtScreen = worldToScreen(applyRotation(targetPoint, frame), viewport);
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
		const srcScreen = worldToScreen(applyRotation(sourcePoint, frame), viewport);
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

			// Endpoints are stored in the connector's un-rotated frame. Map the
			// pointer back through the inverse rotation so a rotated connector's
			// handle tracks the cursor and commits a consistent local-space point.
			const frame = connectorRotationFrame(connector);
			const onMove = (me: PointerEvent) => {
				const wp = applyInverseRotation(
					screenToWorld({ x: me.clientX, y: me.clientY }, viewport),
					frame,
				);

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
					} else if (drag.targetShapeId) {
						// Reconnect to a different shape
						const newTarget = ctx.store.getShape(drag.targetShapeId);
						if (newTarget) {
							commitEndpointReconnect(ctx, connectorId, connector, drag.endpoint, newTarget);
						}
					} else if (currentShapeId) {
						// Slide anchor: commit the new custom position on the same shape
						const currentShape = ctx.store.getShape(currentShapeId);
						if (currentShape) {
							commitAnchorSlide(
								ctx,
								connectorId,
								connector,
								drag.endpoint,
								currentShape,
								drag.currentPoint,
							);
						}
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

function commitEndpointReconnect(
	ctx: PluginContext,
	connectorId: string,
	connector: ShapeData,
	endpoint: "source" | "target",
	newShape: ShapeData,
) {
	const connectorData = connector as ConnectorShapeData;
	const otherShapeId =
		endpoint === "source" ? (connectorData.targetId as string) : (connectorData.sourceId as string);
	const otherShape = ctx.store.getShape(otherShapeId);
	if (!otherShape) return;

	const newCenter = { x: newShape.x + newShape.width / 2, y: newShape.y + newShape.height / 2 };
	const otherCenter = {
		x: otherShape.x + otherShape.width / 2,
		y: otherShape.y + otherShape.height / 2,
	};

	let sourcePoint: Point;
	let targetPoint: Point;

	if (endpoint === "source") {
		sourcePoint = getAnchorPoint(newShape, "auto", otherCenter);
		targetPoint = getAnchorPoint(otherShape, "auto", newCenter);
	} else {
		sourcePoint = getAnchorPoint(otherShape, "auto", newCenter);
		targetPoint = getAnchorPoint(newShape, "auto", otherCenter);
	}

	const fromData: Partial<ConnectorShapeData> = {
		[endpoint === "source" ? "sourceId" : "targetId"]:
			endpoint === "source" ? connectorData.sourceId : connectorData.targetId,
		sourcePoint: connectorData.sourcePoint,
		targetPoint: connectorData.targetPoint,
		sourceAnchor: connectorData.sourceAnchor,
		targetAnchor: connectorData.targetAnchor,
		x: connector.x,
		y: connector.y,
		width: connector.width,
		height: connector.height,
	};

	const toData: Partial<ConnectorShapeData> = {
		[endpoint === "source" ? "sourceId" : "targetId"]: newShape.id,
		sourcePoint,
		targetPoint,
		sourceAnchor: "auto",
		targetAnchor: "auto",
		x: Math.min(sourcePoint.x, targetPoint.x),
		y: Math.min(sourcePoint.y, targetPoint.y),
		width: Math.abs(targetPoint.x - sourcePoint.x),
		height: Math.abs(targetPoint.y - sourcePoint.y),
	};

	ctx.commands.execute(
		createBatchUpdateShapesCommand(ctx.store, [{ id: connectorId, from: fromData, to: toData }]),
	);
}

function commitAnchorSlide(
	ctx: PluginContext,
	connectorId: string,
	connector: ShapeData,
	endpoint: "source" | "target",
	shape: ShapeData,
	dragPoint: Point,
) {
	const connectorData = connector as ConnectorShapeData;
	const edgePoint = clampToShapeEdge(shape, dragPoint);
	const anchorKey = endpoint === "source" ? "sourceAnchor" : "targetAnchor";
	const pointKey = endpoint === "source" ? "sourcePoint" : "targetPoint";

	// Recalculate the other endpoint (it depends on the new position for "auto" anchors)
	const otherShapeId =
		endpoint === "source" ? (connectorData.targetId as string) : (connectorData.sourceId as string);
	const otherShape = ctx.store.getShape(otherShapeId);
	if (!otherShape) return;

	const otherAnchor =
		endpoint === "source"
			? (connectorData.targetAnchor ?? "auto")
			: (connectorData.sourceAnchor ?? "auto");
	const otherPoint =
		otherAnchor === "custom"
			? ((endpoint === "source" ? connectorData.targetPoint : connectorData.sourcePoint) as Point)
			: getAnchorPoint(otherShape, otherAnchor, edgePoint);

	const newSourcePoint = endpoint === "source" ? edgePoint : otherPoint;
	const newTargetPoint = endpoint === "target" ? edgePoint : otherPoint;

	const from: Partial<ConnectorShapeData> = {
		[anchorKey]: connectorData[anchorKey],
		[pointKey]: connectorData[pointKey],
		sourcePoint: connectorData.sourcePoint,
		targetPoint: connectorData.targetPoint,
		x: connector.x,
		y: connector.y,
		width: connector.width,
		height: connector.height,
	};

	const to: Partial<ConnectorShapeData> = {
		[anchorKey]: "custom",
		[pointKey]: edgePoint,
		sourcePoint: newSourcePoint,
		targetPoint: newTargetPoint,
		x: Math.min(newSourcePoint.x, newTargetPoint.x),
		y: Math.min(newSourcePoint.y, newTargetPoint.y),
		width: Math.abs(newTargetPoint.x - newSourcePoint.x),
		height: Math.abs(newTargetPoint.y - newSourcePoint.y),
	};

	ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, [{ id: connectorId, from, to }]));
}

/** Rotation frame of a connector: its bbox center + angle (radians). `null` when unrotated. */
interface RotationFrame {
	center: Point;
	angleRad: number;
}

function connectorRotationFrame(connector: ShapeData): RotationFrame | null {
	const rotation = safeRotation(connector.rotation);
	if (!rotation) return null;
	return {
		center: { x: connector.x + connector.width / 2, y: connector.y + connector.height / 2 },
		angleRad: (rotation * Math.PI) / 180,
	};
}

/** Rotate a stored (local) point into the connector's displayed frame. */
function applyRotation(point: Point, frame: RotationFrame | null): Point {
	return frame ? rotatePoint(point, frame.center, frame.angleRad) : point;
}

/** Inverse of {@link applyRotation}: map a displayed-frame point back to local space. */
function applyInverseRotation(point: Point, frame: RotationFrame | null): Point {
	return frame ? unrotatePoint(point, frame.center, frame.angleRad) : point;
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
