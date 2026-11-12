import { getDefaultControlPoint } from "@edv4h/usketch-connector-anchor";
import type { PluginContext, Point, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { useCallback, useSyncExternalStore } from "react";
import { startEndpointDrag } from "./endpoint-drag.js";
import {
	type EndpointDragState,
	getEndpointDrag,
	subscribeEndpointDrag,
} from "./endpoint-drag-state.js";
import type { ConnectorShapeData } from "./types.js";

const HANDLE_RADIUS = 5;
const STROKE_COLOR = "#2680eb";

interface EndpointOverlayProps {
	ctx: PluginContext;
	viewport: Viewport;
	/** Allow dropping an end on empty space (see `ConnectorPluginOptions.freeEnds`). */
	freeEnds?: boolean;
}

export function EndpointOverlay({ ctx, viewport, freeEnds = false }: EndpointOverlayProps) {
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
				connector={connector}
				ctx={ctx}
				worldPoint={sourcePoint}
				freeEnds={freeEnds}
			/>

			{/* Target handle */}
			<EndpointHandle
				screen={tgtScreen}
				endpoint="target"
				connector={connector}
				ctx={ctx}
				worldPoint={targetPoint}
				freeEnds={freeEnds}
			/>

			{/* Control point handle (for curve) */}
			{cpScreen && (
				<EndpointHandle
					screen={cpScreen}
					endpoint="controlPoint"
					connector={connector}
					ctx={ctx}
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
	connector,
	ctx,
	worldPoint,
	isControlPoint,
	freeEnds = false,
}: {
	screen: Point;
	endpoint: "source" | "target" | "controlPoint";
	connector: ShapeData;
	ctx: PluginContext;
	worldPoint: Point;
	isControlPoint?: boolean;
	freeEnds?: boolean;
}) {
	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			e.stopPropagation();
			e.preventDefault();

			startEndpointDrag(ctx, {
				connector: connector as ConnectorShapeData,
				endpoint,
				startPoint: worldPoint,
				freeEnds,
			});
		},
		[connector, endpoint, worldPoint, ctx, freeEnds],
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

function worldToScreen(point: Point, viewport: Viewport): Point {
	return {
		x: point.x * viewport.zoom + viewport.x,
		y: point.y * viewport.zoom + viewport.y,
	};
}
