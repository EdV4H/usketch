/**
 * Keys for the select tool's delete / lock operations. Each entry is a list of
 * combos in the shortcut registry's format (e.g. `"Mod+Shift+L"`); an empty
 * list leaves the operation unbound. "Self" variants act on the shapes only,
 * keeping their contents (see `createDeleteShapesCommand` / `lockScope`).
 */
export interface SelectToolKeybindings {
	/** Delete the selection with its contents. */
	delete: readonly string[];
	/** Delete only the selected shapes (e.g. a frame), keeping their contents. */
	deleteSelf: readonly string[];
	/** Lock (or unlock) the selection with its contents. */
	toggleLock: readonly string[];
	/** Lock (or unlock) only the selected shapes, leaving their contents editable. */
	toggleLockSelf: readonly string[];
}

export const DEFAULT_SELECT_TOOL_KEYBINDINGS: SelectToolKeybindings = {
	delete: ["Delete", "Backspace"],
	deleteSelf: ["Shift+Delete", "Shift+Backspace"],
	toggleLock: ["Mod+Shift+L"],
	toggleLockSelf: [],
};

/** Overlay the host's overrides on the defaults (an omitted key keeps its default). */
export function resolveSelectToolKeybindings(
	overrides: Partial<SelectToolKeybindings> = {},
): SelectToolKeybindings {
	return { ...DEFAULT_SELECT_TOOL_KEYBINDINGS, ...overrides };
}
