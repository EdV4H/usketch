import type { PluginContext, Point, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { useCallback, useSyncExternalStore } from "react";
import { getAnchorPoint } from "./anchor-utils.js";
import {
	type EndpointDragState,
	getEndpointDrag,
	setEndpointDrag,
	subscribeEndpointDrag,
} from "./endpoint-drag-state.js";
import { getDefaultControlPoint } from "./path-utils.js";
import { findShapeAtPoint } from "./plugin.js";

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

	const sourcePoint = connector.sourcePoint as Point | undefined;
	const targetPoint = connector.targetPoint as Point | undefined;
	if (!sourcePoint || !targetPoint) return null;

	const controlPoint = connector.controlPoint as Point | undefined;
	const pathType = (connector.pathType as string) ?? "straight";
	const showControlHandle = pathType === "curve";
	const cp = controlPoint ?? getDefaultControlPoint(sourcePoint, targetPoint);

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			<svg
				width="100%"
				height="100%"
				style={{
					position: "absolute",
					left: 0,
					top: 0,
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
			</svg>

			{/* Source handle */}
			<EndpointHandle
				point={sourcePoint}
				viewport={viewport}
				endpoint="source"
				connectorId={connectorId}
				connector={connector}
				ctx={ctx}
			/>

			{/* Target handle */}
			<EndpointHandle
				point={targetPoint}
				viewport={viewport}
				endpoint="target"
				connectorId={connectorId}
				connector={connector}
				ctx={ctx}
			/>

			{/* Control point handle (for curve) */}
			{showControlHandle && (
				<EndpointHandle
					point={cp}
					viewport={viewport}
					endpoint="controlPoint"
					connectorId={connectorId}
					connector={connector}
					ctx={ctx}
					isControlPoint
				/>
			)}
		</div>
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
	const sourcePoint = connector.sourcePoint as Point;
	const targetPoint = connector.targetPoint as Point;
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
	point,
	viewport,
	endpoint,
	connectorId,
	connector,
	ctx,
	isControlPoint,
}: {
	point: Point;
	viewport: Viewport;
	endpoint: "source" | "target" | "controlPoint";
	connectorId: string;
	connector: ShapeData;
	ctx: PluginContext;
	isControlPoint?: boolean;
}) {
	const screen = worldToScreen(point, viewport);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();

			const el = e.currentTarget as HTMLElement;
			el.setPointerCapture(e.pointerId);

			setEndpointDrag({
				connectorId,
				endpoint,
				currentPoint: point,
				targetShapeId: null,
			});

			const onMove = (me: PointerEvent) => {
				const worldPoint = screenToWorld({ x: me.clientX, y: me.clientY }, viewport);

				if (endpoint === "controlPoint") {
					// Control point drag: just update position
					setEndpointDrag({
						connectorId,
						endpoint,
						currentPoint: worldPoint,
						targetShapeId: null,
					});
					return;
				}

				const targetShape = findShapeAtPoint(ctx, worldPoint);
				const otherEndShapeId =
					endpoint === "source"
						? (connector.targetId as string | undefined)
						: (connector.sourceId as string | undefined);

				setEndpointDrag({
					connectorId,
					endpoint,
					currentPoint: worldPoint,
					targetShapeId: targetShape && targetShape.id !== otherEndShapeId ? targetShape.id : null,
				});
			};

			const onUp = () => {
				const drag = getEndpointDrag();
				if (drag && drag.connectorId === connectorId) {
					if (drag.endpoint === "controlPoint") {
						// Commit control point position
						const before = {
							controlPoint: connector.controlPoint,
							controlPointAuto: connector.controlPointAuto,
						};
						const after = { controlPoint: drag.currentPoint, controlPointAuto: false };
						ctx.commands.execute(
							createBatchUpdateShapesCommand(ctx.store, [
								{ id: connectorId, from: before, to: after },
							]),
						);
					} else if (drag.targetShapeId) {
						// Reconnect endpoint
						const newTarget = ctx.store.getShape(drag.targetShapeId);
						if (newTarget) {
							commitEndpointReconnect(ctx, connectorId, connector, drag.endpoint, newTarget);
						}
					}
				}
				setEndpointDrag(null);
				el.removeEventListener("pointermove", onMove);
				el.removeEventListener("pointerup", onUp);
			};

			el.addEventListener("pointermove", onMove);
			el.addEventListener("pointerup", onUp);
		},
		[connectorId, connector, endpoint, point, viewport, ctx],
	);

	const r = isControlPoint ? HANDLE_RADIUS - 1 : HANDLE_RADIUS;

	return (
		<div
			onPointerDown={handlePointerDown}
			style={{
				position: "absolute",
				left: screen.x - r - 1,
				top: screen.y - r - 1,
				width: (r + 1) * 2,
				height: (r + 1) * 2,
				pointerEvents: "auto",
				cursor: "grab",
			}}
		>
			<svg width={(r + 1) * 2} height={(r + 1) * 2} style={{ overflow: "visible" }}>
				<circle
					cx={r + 1}
					cy={r + 1}
					r={r}
					fill={isControlPoint ? STROKE_COLOR : "white"}
					stroke={STROKE_COLOR}
					strokeWidth={1.5}
				/>
			</svg>
		</div>
	);
}

function commitEndpointReconnect(
	ctx: PluginContext,
	connectorId: string,
	connector: ShapeData,
	endpoint: "source" | "target",
	newShape: ShapeData,
) {
	const otherShapeId =
		endpoint === "source" ? (connector.targetId as string) : (connector.sourceId as string);
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

	const fromData: Partial<ShapeData> = {
		[endpoint === "source" ? "sourceId" : "targetId"]:
			endpoint === "source" ? connector.sourceId : connector.targetId,
		sourcePoint: connector.sourcePoint,
		targetPoint: connector.targetPoint,
		sourceAnchor: connector.sourceAnchor,
		targetAnchor: connector.targetAnchor,
		x: connector.x,
		y: connector.y,
		width: connector.width,
		height: connector.height,
	};

	const toData: Partial<ShapeData> = {
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
