import type { Point, ShapeData, ShapeDefinition, ToolContext } from "@edv4h/usketch-shared";
import { containerAccepts, isContainerAutoAttach } from "@edv4h/usketch-shared";

type DropTargetCtx = Pick<ToolContext, "store" | "shapes">;

/**
 * Find the container to highlight as the drop target while dragging shapes:
 * the topmost shape under `point` whose definition auto-attaches dropped shapes
 * (`container.autoAttach`, see {@link isContainerAutoAttach}). Shapes in
 * `excludeIds` (the ones being dragged) are skipped.
 *
 * Uses the same predicates as the containment attacher, so only containers that
 * will actually adopt the dropped shapes get highlighted: a container whose
 * `container.accepts` rejects every dragged shape is skipped (the dragged shapes
 * are the ones in `excludeIds`).
 */
export function findDropTarget(
	ctx: DropTargetCtx,
	point: Point,
	excludeIds: ReadonlySet<string>,
): string | null {
	return createDropTargetFinder(ctx, excludeIds)(point);
}

/**
 * {@link findDropTarget} for one drag: the auto-attach containers (front to back,
 * minus `excludeIds`) are collected once, on the first call, and each later call
 * only hit-tests those — instead of copying and walking every shape on every
 * pointer move. Each candidate is re-read from the store per call, so a container
 * that moves, resizes, is deleted or stops auto-attaching mid-drag is still
 * judged by its current state; a container added (or turned into one) mid-drag is
 * picked up by the next drag.
 */
export function createDropTargetFinder(
	ctx: DropTargetCtx,
	excludeIds: ReadonlySet<string>,
): (point: Point) => string | null {
	let candidates: string[] | null = null;
	let dragged: ShapeData[] = [];
	return (point) => {
		if (!candidates) {
			dragged = [...excludeIds].flatMap((id) => {
				const shape = ctx.store.getShape(id);
				return shape ? [shape] : [];
			});
			candidates = [];
			for (const [id, shape] of ctx.store.getShapes()) {
				if (excludeIds.has(id)) continue;
				if (isContainerAutoAttach(ctx.shapes.get(shape.type), shape)) candidates.push(id);
			}
			// Later Map entries are in front.
			candidates.reverse();
		}
		for (const id of candidates) {
			const shape = ctx.store.getShape(id);
			if (!shape) continue;
			const def = ctx.shapes.get(shape.type);
			if (!isContainerAutoAttach(def, shape)) continue;
			if (!containsPoint(def, shape, point)) continue;
			if (dragged.length > 0 && !dragged.some((d) => containerAccepts(def, shape, d))) continue;
			return id;
		}
		return null;
	};
}

function containsPoint(def: ShapeDefinition | undefined, shape: ShapeData, point: Point): boolean {
	const bounds = def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	return (
		point.x >= bounds.x &&
		point.x <= bounds.x + bounds.width &&
		point.y >= bounds.y &&
		point.y <= bounds.y + bounds.height
	);
}
