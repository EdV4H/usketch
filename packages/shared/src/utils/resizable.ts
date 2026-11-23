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

/**
 * Resolve whether a shape can be rotated by the user, honoring both forms of
 * {@link ShapeDefinition.rotatable}. When `rotatable` is omitted it follows
 * {@link isShapeResizable}, matching the behavior before the flag existed.
 */
export function isShapeRotatable(def: ShapeDefinition | undefined, shape: ShapeData): boolean {
	const r = def?.rotatable;
	if (r === undefined) return isShapeResizable(def, shape);
	if (typeof r === "function") return r(shape);
	return r;
}
