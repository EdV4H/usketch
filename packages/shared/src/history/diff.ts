import type { ShapeData } from "../types/shape.js";
import { canonicalJson } from "./canonical-json.js";
import { HISTORY_EXCLUDED_SHAPE_KEYS, type HistoryTreeEntries } from "./objects.js";

/** Shape ids that differ between two trees, each list sorted. */
export interface TreeDiff {
	added: string[];
	removed: string[];
	modified: string[];
}

/**
 * Compare two trees by blob hash. A shape whose hash is the same in both is
 * skipped without reading its content; only `modified` ids need their blobs
 * loaded for a field-level diff ({@link diffShapeFields}).
 */
export function diffTrees(from: HistoryTreeEntries, to: HistoryTreeEntries): TreeDiff {
	const added: string[] = [];
	const removed: string[] = [];
	const modified: string[] = [];
	for (const [id, hash] of Object.entries(to)) {
		const before = from[id];
		if (before === undefined) added.push(id);
		else if (before !== hash) modified.push(id);
	}
	for (const id of Object.keys(from)) {
		if (to[id] === undefined) removed.push(id);
	}
	return { added: added.sort(), removed: removed.sort(), modified: modified.sort() };
}

/** One changed field. `undefined` means the key is absent on that side. */
export interface ShapeFieldChange {
	key: string;
	before: unknown;
	after: unknown;
}

/**
 * Field-level diff of two versions of a shape, sorted by key. Values are
 * compared by content (nested objects included), and the keys history ignores
 * (`updatedAt`) are skipped.
 */
export function diffShapeFields(before: ShapeData, after: ShapeData): ShapeFieldChange[] {
	const beforeRec = before as unknown as Record<string, unknown>;
	const afterRec = after as unknown as Record<string, unknown>;
	const keys = new Set([...Object.keys(beforeRec), ...Object.keys(afterRec)]);
	const changes: ShapeFieldChange[] = [];
	for (const key of [...keys].sort()) {
		if (HISTORY_EXCLUDED_SHAPE_KEYS.has(key)) continue;
		if (canonicalJson(beforeRec[key]) !== canonicalJson(afterRec[key])) {
			changes.push({ key, before: beforeRec[key], after: afterRec[key] });
		}
	}
	return changes;
}
