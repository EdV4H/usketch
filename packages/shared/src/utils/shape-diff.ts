import type { ShapeData } from "../types/shape.js";

/**
 * Keys excluded from shape diffs:
 * - `id` / `type`: identity and type discriminator (never diffed)
 * - `style`: style changes are ignored
 * - `createdAt` / `updatedAt`: store-managed timestamps that the store
 *   overwrites on every mutation; including them would produce non-empty
 *   diffs (and undo/redo commands) even when no user-visible field changed.
 */
const NEVER_DIFF_KEYS: ReadonlySet<string> = new Set([
	"id",
	"type",
	"style",
	"createdAt",
	"updatedAt",
]);

/**
 * Compute the field-level diff between two shapes of the same type.
 *
 * Returns a `Partial<T>` containing only the keys whose values differ by
 * referential `!==` comparison. Used by tools (e.g. `tool-select`) that need
 * to track shape mutations across plugin-defined fields without knowing the
 * concrete shape type at compile time. The generic parameter `T` preserves
 * plugin-defined extension types when the caller has a more specific type.
 *
 * @remarks
 * Encapsulates the `Record<string, unknown>` cast required to iterate over
 * `ShapeData` fields dynamically. Callers should rely on this function rather
 * than re-implementing the loop, so the type escape stays in one place.
 */
export function diffShape<T extends ShapeData>(before: T, after: T): Partial<T> {
	const result: Record<string, unknown> = {};
	const beforeRec = before as unknown as Record<string, unknown>;
	const afterRec = after as unknown as Record<string, unknown>;
	for (const key of Object.keys(after)) {
		if (NEVER_DIFF_KEYS.has(key)) continue;
		if (afterRec[key] !== beforeRec[key]) {
			result[key] = afterRec[key];
		}
	}
	return result as Partial<T>;
}

/**
 * Compute a bidirectional diff (`from` / `to`) for undo/redo command construction.
 * Equivalent to calling `diffShape` twice but iterates fields once.
 */
export function bidiffShape<T extends ShapeData>(
	before: T,
	after: T,
): { from: Partial<T>; to: Partial<T> } {
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
		from: from as Partial<T>,
		to: to as Partial<T>,
	};
}
