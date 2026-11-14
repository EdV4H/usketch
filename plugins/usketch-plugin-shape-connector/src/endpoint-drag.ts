import { clampToShapeEdge } from "@edv4h/usketch-connector-anchor";
import type {
	CanvasPointerEvent,
	PluginContext,
	Point,
	SelectionHandleDrag,
	ToolContext,
} from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { computeEndpointDrop, MIN_DRAG_SCREEN_PX } from "./connector-ends.js";
import { findEndShapeAtPoint, findShapeAtPoint } from "./find-shape-at-point.js";
import type { ConnectorHandleStore } from "./handle-state.js";
import type { ConnectorShapeData } from "./types.js";

type Ctx = PluginContext | ToolContext;

export interface EndpointDragOptions {
	connector: ConnectorShapeData;
	endpoint: "source" | "target" | "controlPoint";
	/** World position of the grabbed handle. */
	startPoint: Point;
	/** Screen position of the press (a move under `MIN_DRAG_SCREEN_PX` from it is not a drag). */
	pressScreenPoint: Point;
	/** Allow dropping an end on empty space (see `ConnectorPluginOptions.freeEnds`). */
	freeEnds?: boolean;
	state: ConnectorHandleStore;
}

/**
 * Drag a connector end (or the curve's control point). The select tool forwards
 * the canvas pointer events (`worldPoint` is relative to the canvas and uses
 * the current viewport), and the release commits one undoable change.
 */
export function createEndpointDrag(ctx: Ctx, options: EndpointDragOptions): SelectionHandleDrag {
	const { connector, endpoint, startPoint, pressScreenPoint, freeEnds = false, state } = options;
	const connectorId = connector.id;
	// The shape this end is attached to now, and the shape at the other end.
	const currentShapeId = endpoint === "source" ? connector.sourceId : connector.targetId;
	const otherEndShapeId = endpoint === "source" ? connector.targetId : connector.sourceId;

	const setDrag = (currentPoint: Point, targetShapeId: string | null) =>
		state.set({ endpointDrag: { connectorId, endpoint, currentPoint, targetShapeId } });
	setDrag(startPoint, null);
	let moved = false;

	return {
		cursor: "grabbing",
		move(event: CanvasPointerEvent) {
			const wp = event.worldPoint;
			// A jittery click is not a drag: it must not pin a control point or
			// re-anchor an end (and the select tool then treats it as a click).
			if (!moved) {
				const d = Math.hypot(
					event.screenPoint.x - pressScreenPoint.x,
					event.screenPoint.y - pressScreenPoint.y,
				);
				if (d < MIN_DRAG_SCREEN_PX) return;
				moved = true;
			}

			if (endpoint === "controlPoint") {
				setDrag(wp, null);
				// Live-update the curve so the bend (and the handle, which reads the
				// shape's controlPoint) follows the pointer. The undoable command is
				// committed once on release (before = the value at the press).
				ctx.store.updateShape(connectorId, {
					controlPoint: wp,
					controlPointAuto: false,
				} as Partial<ConnectorShapeData>);
				return;
			}

			// Over the same shape (slide the anchor) or a different one (reconnect)?
			const hoverShape = freeEnds
				? findEndShapeAtPoint(ctx, wp, ctx.store.getViewport().zoom)
				: findShapeAtPoint(ctx, wp);
			if (hoverShape && hoverShape.id === currentShapeId) {
				setDrag(clampToShapeEdge(hoverShape, wp), null);
			} else {
				setDrag(wp, hoverShape && hoverShape.id !== otherEndShapeId ? hoverShape.id : null);
			}
		},
		end(event: CanvasPointerEvent) {
			const drag = state.get().endpointDrag;
			state.set({ endpointDrag: null });
			if (!moved || !drag) return false;
			if (endpoint === "controlPoint") {
				const before: Partial<ConnectorShapeData> = {
					controlPoint: connector.controlPoint,
					controlPointAuto: connector.controlPointAuto,
				};
				const after: Partial<ConnectorShapeData> = {
					controlPoint: event.worldPoint,
					controlPointAuto: false,
				};
				ctx.commands.execute(
					createBatchUpdateShapesCommand(ctx.store, [{ id: connectorId, from: before, to: after }]),
				);
				return true;
			}
			// A real drag, even one that changes nothing (e.g. dropped on the other
			// end's shape): never a click.
			commitEndpointDrop(ctx, connectorId, endpoint, startPoint, event.worldPoint, freeEnds);
			return true;
		},
		cancel() {
			state.set({ endpointDrag: null });
			// The control point was live-updated without history: put it back.
			if (endpoint === "controlPoint" && moved) {
				ctx.store.updateShape(connectorId, {
					controlPoint: connector.controlPoint,
					controlPointAuto: connector.controlPointAuto,
				} as Partial<ConnectorShapeData>);
			}
		},
	};
}

/** Commit a dragged endpoint (see {@link computeEndpointDrop}), if it changes anything. */
function commitEndpointDrop(
	ctx: Ctx,
	connectorId: string,
	endpoint: "source" | "target",
	startPoint: Point,
	dropPoint: Point,
	freeEnds: boolean,
): void {
	const connector = ctx.store.getShape(connectorId) as ConnectorShapeData | undefined;
	if (!connector) return;
	const zoom = ctx.store.getViewport().zoom;
	const dropShape = freeEnds
		? findEndShapeAtPoint(ctx, dropPoint, zoom)
		: findShapeAtPoint(ctx, dropPoint);
	const change = computeEndpointDrop(
		connector,
		endpoint,
		{ shape: dropShape, point: dropPoint },
		{ startPoint, zoom, freeEnds, getShape: (id) => ctx.store.getShape(id) },
	);
	if (!change) return;
	ctx.commands.execute(createBatchUpdateShapesCommand(ctx.store, [{ id: connectorId, ...change }]));
}
