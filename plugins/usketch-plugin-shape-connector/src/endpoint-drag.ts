import { clampToShapeEdge } from "@edv4h/usketch-connector-anchor";
import type { CanvasPointerEvent, PluginContext, Point } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { computeEndpointDrop } from "./connector-ends.js";
import { getEndpointDrag, setEndpointDrag } from "./endpoint-drag-state.js";
import { findEndShapeAtPoint, findShapeAtPoint } from "./find-shape-at-point.js";
import type { ConnectorShapeData } from "./types.js";

/** Where the window listeners go. Injectable so the drag can be tested without a DOM. */
export type DragWindow = Pick<Window, "addEventListener" | "removeEventListener">;

export interface StartEndpointDragOptions {
	connector: ConnectorShapeData;
	endpoint: "source" | "target" | "controlPoint";
	/** World position of the grabbed handle. */
	startPoint: Point;
	/** Allow dropping an end on empty space (see `ConnectorPluginOptions.freeEnds`). */
	freeEnds?: boolean;
	win?: DragWindow;
}

/**
 * Drag a connector end (or the curve's control point) from a pressed handle
 * until the pointer is released, then commit one undoable change.
 *
 * The pointer is read from the canvas events (`canvas:pointermove` /
 * `canvas:pointerup`). Their `worldPoint` is relative to the canvas, which need
 * not start at the page's top-left (a side panel can push it right), and uses
 * the viewport at that moment, so the drag stays right when the canvas is
 * offset or the view zooms mid-drag. `window` client coordinates are not canvas
 * coordinates. A release off the canvas (over a panel) is caught on `window` and
 * ends at the last point the canvas reported.
 *
 * Returns a function that ends the drag without committing.
 */
export function startEndpointDrag(
	ctx: PluginContext,
	options: StartEndpointDragOptions,
): () => void {
	const { connector, endpoint, startPoint, freeEnds = false } = options;
	const win = options.win ?? window;
	const connectorId = connector.id;
	// The shape this end is attached to now, and the shape at the other end.
	const currentShapeId = endpoint === "source" ? connector.sourceId : connector.targetId;
	const otherEndShapeId = endpoint === "source" ? connector.targetId : connector.sourceId;

	setEndpointDrag({ connectorId, endpoint, currentPoint: startPoint, targetShapeId: null });

	// Raw pointer position (drag.currentPoint is clamped while sliding).
	let pointer = startPoint;

	const onMove = (event: CanvasPointerEvent) => {
		const wp = event.worldPoint;
		pointer = wp;

		if (endpoint === "controlPoint") {
			setEndpointDrag({ connectorId, endpoint, currentPoint: wp, targetShapeId: null });
			// Live-update the curve so the bend (and the handle, which reads the
			// shape's controlPoint) follows the pointer during the drag instead of
			// only snapping into place on release. The single undoable command is
			// still committed once on release (before = original captured at
			// pointerdown, after = final position).
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
			setEndpointDrag({
				connectorId,
				endpoint,
				currentPoint: clampToShapeEdge(hoverShape, wp),
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

	let finished = false;
	const stop = () => {
		if (finished) return;
		finished = true;
		setEndpointDrag(null);
		offMove();
		offUp();
		win.removeEventListener("pointerup", onWindowUp);
		win.removeEventListener("pointercancel", onWindowUp);
	};

	const commit = () => {
		if (finished) return;
		const drag = getEndpointDrag();
		if (drag && drag.connectorId === connectorId) {
			if (drag.endpoint === "controlPoint") {
				const before: Partial<ConnectorShapeData> = {
					controlPoint: connector.controlPoint,
					controlPointAuto: connector.controlPointAuto,
				};
				const after: Partial<ConnectorShapeData> = {
					controlPoint: drag.currentPoint,
					controlPointAuto: false,
				};
				ctx.commands.execute(
					createBatchUpdateShapesCommand(ctx.store, [{ id: connectorId, from: before, to: after }]),
				);
			} else {
				commitEndpointDrop(ctx, connectorId, drag.endpoint, startPoint, pointer, freeEnds);
			}
		}
		stop();
	};

	// Released over the canvas: its pointerup carries the exact drop point.
	const onCanvasUp = (event: CanvasPointerEvent) => {
		pointer = event.worldPoint;
		commit();
	};
	const onWindowUp = () => commit();

	const offMove = ctx.events.on<CanvasPointerEvent>("canvas:pointermove", onMove);
	const offUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", onCanvasUp);
	win.addEventListener("pointerup", onWindowUp);
	win.addEventListener("pointercancel", onWindowUp);

	return stop;
}

/** Commit a dragged endpoint (see {@link computeEndpointDrop}). */
function commitEndpointDrop(
	ctx: PluginContext,
	connectorId: string,
	endpoint: "source" | "target",
	startPoint: Point,
	dropPoint: Point,
	freeEnds: boolean,
) {
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
