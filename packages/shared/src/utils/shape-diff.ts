import type { ShapeData } from "../types/shape.js";

/**
 * Keys that are never part of a shape diff: identity, type discriminator, and
 * style (treated as a single object reference, not field-by-field).
 */
const NEVER_DIFF_KEYS: ReadonlySet<string> = new Set(["id", "type", "style"]);

/**
 * Compute the field-level diff between two shapes of the same type.
 *
 * Returns a `Partial<ShapeData>` containing only the keys whose values differ
 * by referential `!==` comparison. Used by tools (e.g. `tool-select`) that need
 * to track shape mutations across plugin-defined fields without knowing the
 * concrete shape type at compile time.
 *
 * @remarks
 * Encapsulates the `Record<string, unknown>` cast required to iterate over
 * `ShapeData` fields dynamically. Callers should rely on this function rather
 * than re-implementing the loop, so the type escape stays in one place.
 */
export function diffShape(before: ShapeData, after: ShapeData): Partial<ShapeData> {
	const result: Record<string, unknown> = {};
	const beforeRec = before as unknown as Record<string, unknown>;
	const afterRec = after as unknown as Record<string, unknown>;
	for (const key of Object.keys(after)) {
		if (NEVER_DIFF_KEYS.has(key)) continue;
		if (afterRec[key] !== beforeRec[key]) {
			result[key] = afterRec[key];
		}
	}
	return result as Partial<ShapeData>;
}

/**
 * Compute a bidirectional diff (`from` / `to`) for undo/redo command construction.
 * Equivalent to calling `diffShape` twice but iterates fields once.
 */
export function bidiffShape(
	before: ShapeData,
	after: ShapeData,
): { from: Partial<ShapeData>; to: Partial<ShapeData> } {
	const from: Record<string, unknown> = {};
	const to: Record<string, unknown> = {};
	const beforeRec = before as unknown as Record<string, unknown>;
	const afterRec = after as unknown as Record<string, unknown>;
	for (const key of Object.keys(after)) {
		if (NEVER_DIFF_KEYS.has(key)) continue;
		if (afterRec[key] !== beforeRec[key]) {
			from[key] = beforeRec[key];
			to[key] = afterRec[key];
		}
	}
	return {
		from: from as Partial<ShapeData>,
		to: to as Partial<ShapeData>,
	};
}
