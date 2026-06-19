import type { ShapeDefinition } from "../types/plugin.js";
import type { ShapeData } from "../types/shape.js";

/**
 * Resolve whether a shape is resizable, honoring both the boolean and the
 * predicate form of {@link ShapeDefinition.resizable}.
 *
 * - `undefined` → `true` (default: resizable)
 * - `boolean`   → that value
 * - `(data) => boolean` → evaluated against the shape instance
 *
 * Centralizes the rule so the selection overlay and the resize/rotation
 * hit-tests stay consistent.
 */
export function isShapeResizable(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	const r = def?.resizable;
	if (typeof r === "function") return r(shape);
	return r !== false;
}
