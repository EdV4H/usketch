import {
	clampToShapeEdge,
	findShapeAtPoint as findShapeAtPointGeneric,
} from "@edv4h/usketch-connector-anchor";
import type { PluginContext, Point, ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { isShapeContainer } from "@edv4h/usketch-shared";

// Exclude all known connector types so connector tools never anchor to another
// connector. "domain-connector" lives in the DDD plugin, but listing the string
// here (rather than importing the constant) keeps shape-connector free of any
// reverse dependency on domain-design.
const EXCLUDE_CONNECTOR = new Set(["connector", "domain-connector"]);

/**
 * Find the connector anchor target at a point: topmost by zIndex, skipping
 * connectors and hidden / locked shapes, and preferring children over
 * frames / groups. Shared by the connector tool, the endpoint overlay and the
 * anchor-handle overlay so all three pick the same shape.
 */
export function findShapeAtPoint(ctx: ToolContext | PluginContext, point: Point): ShapeData | null {
	return findShapeAtPointGeneric(ctx, point, { excludeTypes: EXCLUDE_CONNECTOR });
}

/** How close (screen px) to a container's edge a free-end drop must be to connect to it. */
export const CONTAINER_EDGE_SCREEN_PX = 8;

/**
 * Where a connector end lands when free ends are enabled. Like
 * {@link findShapeAtPoint}, except that the inside of a container (frame /
 * group) counts as empty space: a container is a target only near its edge.
 * Otherwise every point inside a frame would connect to the frame and a free
 * end could never be placed there.
 */
export function findEndShapeAtPoint(
	ctx: ToolContext | PluginContext,
	point: Point,
	zoom: number,
): ShapeData | null {
	const shape = findShapeAtPoint(ctx, point);
	if (!shape || !isShapeContainer(ctx.shapes.get(shape.type), shape)) return shape;
	const edge = clampToShapeEdge(shape, point);
	const dist = Math.hypot(edge.x - point.x, edge.y - point.y) * Math.abs(zoom);
	return dist <= CONTAINER_EDGE_SCREEN_PX ? shape : null;
}
