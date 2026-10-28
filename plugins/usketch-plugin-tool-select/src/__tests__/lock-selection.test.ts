import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore, isEffectivelyLocked } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { resolveSelectToolKeybindings } from "../keybindings.js";
import { createToggleLockSelectionCommand } from "../lock-selection.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: overrides.id ?? "s1",
		type: overrides.type ?? "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

function setup() {
	const store = createBoardStore();
	store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
	store.addShape(makeShape({ id: "A", parentId: "frame" }));
	const get = (id: string) => store.getShape(id) as ShapeData;
	return { store, get };
}

describe("createToggleLockSelectionCommand", () => {
	it("locks with contents by default, then unlocks on the next toggle", () => {
		const { store, get } = setup();
		store.setSelection(["frame"]);
		createToggleLockSelectionCommand(store)?.execute();
		expect(get("frame")).toMatchObject({ locked: true, lockScope: undefined });
		expect(isEffectivelyLocked(store, get("A"))).toBe(true);

		createToggleLockSelectionCommand(store)?.execute();
		expect(get("frame").locked).toBeUndefined();
	});

	it('"self" locks the frame only, leaving its contents editable; undo restores', () => {
		const { store, get } = setup();
		store.setSelection(["frame"]);
		const cmd = createToggleLockSelectionCommand(store, "self");
		cmd?.execute();
		expect(get("frame")).toMatchObject({ locked: true, lockScope: "self" });
		expect(isEffectivelyLocked(store, get("A"))).toBe(false);

		cmd?.undo();
		expect(get("frame").locked).toBeUndefined();
	});

	it("switches scope instead of unlocking when the other variant is used", () => {
		const { store, get } = setup();
		store.setSelection(["frame"]);
		createToggleLockSelectionCommand(store)?.execute();
		createToggleLockSelectionCommand(store, "self")?.execute();
		expect(get("frame")).toMatchObject({ locked: true, lockScope: "self" });
	});

	it("locks all when the selection is mixed, and returns null for an empty selection", () => {
		const { store, get } = setup();
		store.updateShape("A", { locked: true });
		store.setSelection(["frame", "A"]);
		createToggleLockSelectionCommand(store)?.execute();
		expect(get("frame").locked).toBe(true);
		expect(get("A").locked).toBe(true);

		store.setSelection([]);
		expect(createToggleLockSelectionCommand(store)).toBeNull();
	});
});

describe("resolveSelectToolKeybindings", () => {
	it("keeps defaults for omitted keys and lets a host rebind or unbind", () => {
		const keys = resolveSelectToolKeybindings({ deleteSelf: ["Alt+Delete"], toggleLock: [] });
		expect(keys.delete).toEqual(["Delete", "Backspace"]);
		expect(keys.deleteSelf).toEqual(["Alt+Delete"]);
		expect(keys.toggleLock).toEqual([]);
	});
});
