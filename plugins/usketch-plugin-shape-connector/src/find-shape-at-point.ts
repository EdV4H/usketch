import { findShapeAtPoint as findShapeAtPointGeneric } from "@edv4h/usketch-connector-anchor";
import type { PluginContext, Point, ShapeData, ToolContext } from "@edv4h/usketch-shared";

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
