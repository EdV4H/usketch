// The 3D operations on shapes, as plain functions over a BoardStore. The HUD and the
// service only call these (docs/plugin-system-design.md).
import { type BoardStore, rawShapeView3d, shapeView3dPatch } from "@edv4h/usketch-shared";
import {
	availableModes,
	DEFAULT_SHAPE_3D_TYPES,
	normalizeShape3d,
	ownShape3d,
	type Shape3dInput,
	type Shape3dParams,
	type Shape3dTypes,
	storedShape3d,
} from "./shape-3d-params.js";

/** A shape's own 3D parameters (normalized), or `null` when it has none / it's missing. */
export function getShape3d(store: BoardStore, id: string): Shape3dParams | null {
	const shape = store.getShape(id);
	return shape ? ownShape3d(shape) : null;
}

/**
 * Merge `patch` into each shape's own 3D parameters (a shape without any takes the
 * defaults; give `mode` to start one). Shapes whose type doesn't allow the resulting
 * mode (per `types`, the built-in {@link DEFAULT_SHAPE_3D_TYPES} unless given), missing / locked shapes, and patches that leave no valid mode are skipped.
 * Returns the ids actually updated.
 */
export function setShape3d(
	store: BoardStore,
	ids: Iterable<string>,
	patch: Shape3dInput,
	types: Shape3dTypes = DEFAULT_SHAPE_3D_TYPES,
): string[] {
	const updated: string[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (!shape || shape.locked) continue;
		// Merge over what the shape holds (not its normalized form), so a defaulted height
		// stays a default when the mode changes.
		const own = rawShapeView3d(shape);
		const merged = { ...(own && typeof own === "object" ? own : {}), ...patch };
		const next = normalizeShape3d(merged);
		if (!next || !availableModes(types, shape.type).includes(next.mode)) continue;
		// Stored under `view3d` and, until the next major, the older key too.
		store.updateShape(id, shapeView3dPatch(storedShape3d(merged) ?? undefined));
		updated.push(id);
	}
	return updated;
}

/** Remove the 3D parameters from each shape (back to flat). Returns the ids changed. */
export function clearShape3d(store: BoardStore, ids: Iterable<string>): string[] {
	const cleared: string[] = [];
	for (const id of ids) {
		const shape = store.getShape(id);
		if (!shape || shape.locked || rawShapeView3d(shape) === undefined) continue;
		store.updateShape(id, shapeView3dPatch(undefined));
		cleared.push(id);
	}
	return cleared;
}
