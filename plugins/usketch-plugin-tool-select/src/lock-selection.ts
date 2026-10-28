// Lock / unlock the selection as a plain function over the BoardStore (per
// docs/plugin-system-design.md), the lock counterpart of delete-selection.ts.
import type { BoardStore, Command } from "@edv4h/usketch-shared";
import { createSetLockedCommand, isEffectivelyHidden } from "@edv4h/usketch-store";

/**
 * A command toggling the lock on the selection, or `null` when nothing is
 * selected. When every selected shape is already locked with this `scope` it
 * unlocks them; otherwise it locks them all with it. By default the lock
 * cascades to the contents; `"self"` locks only the shapes themselves (e.g. a
 * frame whose items stay editable). Hidden shapes are skipped.
 */
export function createToggleLockSelectionCommand(
	store: BoardStore,
	scope?: "self",
): Command | null {
	const shapes = [];
	for (const id of store.getSelection()) {
		const shape = store.getShape(id);
		if (shape && !isEffectivelyHidden(store, shape)) shapes.push(shape);
	}
	if (shapes.length === 0) return null;
	const allLocked = shapes.every((s) => s.locked === true && s.lockScope === scope);
	return createSetLockedCommand(
		store,
		shapes.map((s) => s.id),
		!allLocked,
		scope,
	);
}
