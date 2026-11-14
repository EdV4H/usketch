// The 3D operations on shapes, as plain functions over a BoardStore. The HUD and the
// service only call these (docs/plugin-system-design.md); a host can call them too.
import {
	type BoardStore,
	normalizeShapeView3d,
	rawShapeView3d,
	readShapeView3d,
	type ShapeTypeView3d,
	type ShapeView3d,
	type ShapeView3dInput,
	shapeTypeModes,
	shapeView3dPatch,
	storedShapeView3d,
} from "@edv4h/usketch-shared";
import { DEFAULT_SHAPE_3D_TYPES, type Shape3dTypes } from "./shape-3d-params.js";

/**
 * Each shape type's 3D, to check the modes it may use: a table by type, or a lookup such
 * as `(type) => ctx.shapes.getView3d?.(type)`.
 */
export type ShapeView3dTypes = Shape3dTypes | ((type: string) => ShapeTypeView3d | undefined);

function typeView3d(types: ShapeView3dTypes, type: string): ShapeTypeView3d | undefined {
	return typeof types === "function" ? types(type) : types[type];
}

/** A shape's own 3D parameters (normalized), or `null` when it has none / it's missing. */
export function getShapeView3d(store: BoardStore, id: string): ShapeView3d | null {
	const shape = store.getShape(id);
	return shape ? readShapeView3d(shape) : null;
}

/**
 * Merge `patch` into each shape's own 3D parameters (a shape without any takes the
 * defaults; give `mode` to start one). Shapes whose type doesn't allow the resulting mode
 * (per `types`, the built-in {@link DEFAULT_SHAPE_3D_TYPES} unless given), missing /
 * locked shapes, and patches that leave no valid mode are skipped. Stored under `view3d`
 * and, until the next major, the older key too. Returns the ids actually updated.
 */
export function setShapeView3d(
	store: BoardStore,
	ids: Iterable<string>,
	patch: ShapeView3dInput,
	types: ShapeView3dTypes = DEFAULT_SHAPE_3D_TYPES,
): string[] {
	const updated: string[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (!shape || shape.locked) continue;
		// Merge over what the shape holds (not its normalized form), so a defaulted height
		// stays a default when the mode changes.
		const own = rawShapeView3d(shape);
		const merged = { ...(own && typeof own === "object" ? own : {}), ...patch };
		const next = normalizeShapeView3d(merged);
		if (!next || !shapeTypeModes(typeView3d(types, shape.type)).includes(next.mode)) continue;
		store.updateShape(id, shapeView3dPatch(storedShapeView3d(merged) ?? undefined));
		updated.push(id);
	}
	return updated;
}

/** Remove the 3D parameters from each shape (back to flat). Returns the ids changed. */
export function clearShapeView3d(store: BoardStore, ids: Iterable<string>): string[] {
	const cleared: string[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (!shape || shape.locked || rawShapeView3d(shape) === undefined) continue;
		store.updateShape(id, shapeView3dPatch(undefined));
		cleared.push(id);
	}
	return cleared;
}

/** @deprecated Use {@link getShapeView3d}; removed at the next major. */
export const getShape3d = getShapeView3d;
/** @deprecated Use {@link setShapeView3d}; removed at the next major. */
export const setShape3d = setShapeView3d;
/** @deprecated Use {@link clearShapeView3d}; removed at the next major. */
export const clearShape3d = clearShapeView3d;
