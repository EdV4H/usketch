import type { Point, ToolContext } from "@edv4h/usketch-shared";
import { isContainerAutoAttach } from "@edv4h/usketch-shared";

/**
 * Find the container to highlight as the drop target while dragging shapes:
 * the topmost shape under `point` whose definition auto-attaches dropped shapes
 * (`container.autoAttach`, see {@link isContainerAutoAttach}). Shapes in
 * `excludeIds` (the ones being dragged) are skipped.
 *
 * Uses the same predicate as the containment attacher, so only containers that
 * will actually adopt the dropped shapes get highlighted.
 */
export function findDropTarget(
	ctx: Pick<ToolContext, "store" | "shapes">,
	point: Point,
	excludeIds: ReadonlySet<string>,
): string | null {
	const entries = [...ctx.store.getShapes().entries()].reverse();
	for (const [id, shape] of entries) {
		if (excludeIds.has(id)) continue;
		const def = ctx.shapes.get(shape.type);
		if (!isContainerAutoAttach(def, shape)) continue;
		const bounds = def
			? def.getBounds(shape)
			: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
		if (
			point.x >= bounds.x &&
			point.x <= bounds.x + bounds.width &&
			point.y >= bounds.y &&
			point.y <= bounds.y + bounds.height
		) {
			return id;
		}
	}
	return null;
}
