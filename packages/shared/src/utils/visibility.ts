import type { ShapeData } from "../types/shape.js";

/**
 * Whether a shape carries its own `hidden` flag. This checks the shape in
 * isolation — it does NOT consider ancestors. For the cascaded/effective
 * result (a shape is hidden if it or any ancestor is hidden) use
 * `isEffectivelyHidden` from `@edv4h/usketch-store`.
 */
export function isShapeHidden(shape: ShapeData): boolean {
	return shape.hidden === true;
}

/**
 * Whether a shape carries its own `locked` flag. This checks the shape in
 * isolation — it does NOT consider ancestors. For the cascaded/effective
 * result use `isEffectivelyLocked` from `@edv4h/usketch-store`.
 */
export function isShapeLocked(shape: ShapeData): boolean {
	return shape.locked === true;
}
