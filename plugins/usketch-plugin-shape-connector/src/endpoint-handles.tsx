import { getDefaultControlPoint } from "@edv4h/usketch-connector-anchor";
import type {
	Point,
	SelectionHandle,
	SelectionHandleProvider,
	SelectionHandleRenderContext,
	ShapeData,
	ShapeRegistry,
	Viewport,
} from "@edv4h/usketch-shared";
import { worldToScreen } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { createEndpointDrag } from "./endpoint-drag.js";
import type { ConnectorHandleStore, EndpointDragState } from "./handle-state.js";
import type { ConnectorShapeData } from "./types.js";

const HANDLE_RADIUS = 5;
const CONTROL_RADIUS = HANDLE_RADIUS - 1;

type Endpoint = "source" | "target" | "controlPoint";

/** The selected connector, when exactly one connector with both ends is selected. */
function selectedConnector(
	selection: ReadonlySet<string>,
	getShape: (id: string) => ShapeData | undefined,
): ConnectorShapeData | null {
	if (selection.size !== 1) return null;
	const shape = getShape([...selection][0] as string);
	if (shape?.type !== "connector") return null;
	const c = shape as ConnectorShapeData;
	return c.sourcePoint && c.targetPoint ? c : null;
}

/**
 * The end points (and, for a curve, the control point) of the selected
 * connector, as select-tool handles: drag one to re-anchor that end.
 */
export function createEndpointHandleProvider(options: {
	id: string;
	freeEnds: boolean;
	state: ConnectorHandleStore;
}): SelectionHandleProvider {
	const { id, freeEnds, state } = options;
	return {
		id,
		// Above the anchor handles: an end attached at an anchor sits exactly on
		// that shape's anchor handle, and re-anchoring the end is what's meant.
		priority: 10,
		getHandles({ selection, store }) {
			const c = selectedConnector(selection, (sid) => store.getShape(sid));
			if (!c) return [];
			const handles: SelectionHandle[] = [
				{ id: "source", point: c.sourcePoint as Point, cursor: "grab", shapeId: c.id },
				{ id: "target", point: c.targetPoint as Point, cursor: "grab", shapeId: c.id },
			];
			if ((c.pathType ?? "straight") === "curve") {
				handles.push({
					id: "controlPoint",
					point:
						c.controlPoint ??
						getDefaultControlPoint(c.sourcePoint as Point, c.targetPoint as Point),
					hitRadius: CONTROL_RADIUS + 4,
					cursor: "grab",
					shapeId: c.id,
				});
			}
			return handles;
		},
		startDrag(handle, event, ctx) {
			const c = selectedConnector(ctx.store.getSelection(), (sid) => ctx.store.getShape(sid));
			if (!c) return null;
			return createEndpointDrag(ctx, {
				connector: c,
				endpoint: handle.id as Endpoint,
				startPoint: handle.point,
				pressScreenPoint: event.screenPoint,
				freeEnds,
				state,
			});
		},
		render: (ctx) => <EndpointHandles ctx={ctx} state={state} />,
	};
}

function EndpointHandles({
	ctx,
	state,
}: {
	ctx: SelectionHandleRenderContext;
	state: ConnectorHandleStore;
}) {
	const drag = useSyncExternalStore(state.subscribe, state.get, state.get).endpointDrag;
	const { handles, viewport, colors } = ctx;
	if (handles.length === 0) return null;
	const c = selectedConnector(ctx.selection, (id) => ctx.store.getShape(id));
	const byId = new Map(handles.map((h) => [h.id, h]));
	const source = byId.get("source");
	const target = byId.get("target");
	const control = byId.get("controlPoint");

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
			aria-hidden
		>
			{ctx.dragging && drag && c && drag.connectorId === c.id && (
				<DragPreview drag={drag} connector={c} viewport={viewport} stroke={colors.stroke} />
			)}
			{ctx.dragging && drag?.targetShapeId && (
				<TargetHighlight
					shape={ctx.store.getShape(drag.targetShapeId)}
					shapes={ctx.shapes}
					viewport={viewport}
					stroke={colors.stroke}
				/>
			)}
			{/* Control point guide lines (curve) */}
			{control && source && target && (
				<>
					<GuideLine
						from={ctx.toScreen(source)}
						to={ctx.toScreen(control)}
						stroke={colors.stroke}
					/>
					<GuideLine
						from={ctx.toScreen(control)}
						to={ctx.toScreen(target)}
						stroke={colors.stroke}
					/>
				</>
			)}
			{handles.map((h) => {
				const p = ctx.toScreen(h);
				const isControl = h.id === "controlPoint";
				const hovered = ctx.hoveredHandleId === h.id;
				const r = (isControl ? CONTROL_RADIUS : HANDLE_RADIUS) + (hovered ? 1 : 0);
				return (
					<circle
						key={h.id}
						cx={p.x}
						cy={p.y}
						r={r}
						strokeWidth={1.5}
						style={{ fill: isControl ? colors.stroke : colors.fill, stroke: colors.stroke }}
					/>
				);
			})}
		</svg>
	);
}

function GuideLine({ from, to, stroke }: { from: Point; to: Point; stroke: string }) {
	return (
		<line
			x1={from.x}
			y1={from.y}
			x2={to.x}
			y2={to.y}
			strokeWidth={0.5}
			opacity={0.4}
			style={{ stroke }}
		/>
	);
}

/** Dashed line from the other end to the dragged end. */
function DragPreview({
	drag,
	connector,
	viewport,
	stroke,
}: {
	drag: EndpointDragState;
	connector: ConnectorShapeData;
	viewport: Viewport;
	stroke: string;
}) {
	if (drag.endpoint === "controlPoint") return null;
	const other = (
		drag.endpoint === "source" ? connector.targetPoint : connector.sourcePoint
	) as Point;
	const a = worldToScreen(drag.currentPoint.x, drag.currentPoint.y, viewport);
	const b = worldToScreen(other.x, other.y, viewport);
	return (
		<line
			x1={a.x}
			y1={a.y}
			x2={b.x}
			y2={b.y}
			strokeWidth={1.5}
			strokeDasharray="4 3"
			style={{ stroke }}
		/>
	);
}

/** Dashed outline of the shape the dragged end would attach to. */
function TargetHighlight({
	shape,
	shapes,
	viewport,
	stroke,
}: {
	shape: ShapeData | undefined;
	shapes: ShapeRegistry;
	viewport: Viewport;
	stroke: string;
}) {
	if (!shape) return null;
	const def = shapes.get(shape.type);
	const b = def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const tl = worldToScreen(b.x, b.y, viewport);
	return (
		<rect
			x={tl.x}
			y={tl.y}
			width={b.width * viewport.zoom}
			height={b.height * viewport.zoom}
			fill="none"
			strokeWidth={2}
			strokeDasharray="5 3"
			rx={3}
			style={{ stroke }}
		/>
	);
}
