// Delete the selection as a plain function over the BoardStore (per
// docs/plugin-system-design.md), so a host toolbar can offer the same
// "delete with contents / delete frame only" choice as its lock menu.
import type { BoardStore, Command } from "@edv4h/usketch-shared";
import {
	createDeleteShapesCommand,
	isEffectivelyHidden,
	isEffectivelyLocked,
} from "@edv4h/usketch-store";

/**
 * A command deleting the deletable part of the selection, or `null` when
 * nothing can be deleted. Locked or hidden shapes (or those under such an
 * ancestor) resist deletion — both are excluded from canvas interaction — and
 * stay selected. By default each shape's contents go with it; `"self"` keeps
 * the contents (e.g. deletes a frame but leaves its items in place). The scope
 * mirrors `createSetLockedCommand` / `lockScope`.
 */
export function createDeleteSelectionCommand(store: BoardStore, scope?: "self"): Command | null {
	const ids: string[] = [];
	for (const id of store.getSelection()) {
		const shape = store.getShape(id);
		if (!shape || isEffectivelyLocked(store, shape) || isEffectivelyHidden(store, shape)) continue;
		ids.push(id);
	}
	return ids.length > 0 ? createDeleteShapesCommand(store, ids, scope) : null;
}
