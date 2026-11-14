import { describe, expect, it, vi } from "vitest";
import { createKeymap } from "../keymap.js";
import {
	bindKeymapStorage,
	type KeymapOverrides,
	parseKeymapOverrides,
} from "../keymap-storage.js";
import {
	assignKey,
	bindingsUsingKey,
	comboFromKeyEvent,
	formatCombo,
	formatKeyCode,
	isReservedCombo,
	unassignKey,
} from "../keymap-ui.js";

function keyEvent(
	key: string,
	code: string,
	mods: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">> = {},
): KeyboardEvent {
	return {
		key,
		code,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		...mods,
	} as unknown as KeyboardEvent;
}

describe("formatCombo / formatKeyCode", () => {
	it("shows Mod as ⌘ on macOS and Ctrl elsewhere", () => {
		expect(formatCombo("Mod+Shift+Z", { isMac: true })).toBe("⇧⌘Z");
		expect(formatCombo("Mod+Shift+Z", { isMac: false })).toBe("Ctrl+Shift+Z");
		expect(formatCombo("Ctrl+Alt+K", { isMac: true })).toBe("⌃⌥K");
		expect(formatCombo("?", { isMac: false })).toBe("?");
		expect(formatCombo("Space", { isMac: false })).toBe("Space");
		expect(formatCombo("ArrowUp", { isMac: false })).toBe("↑");
		expect(formatKeyCode("KeyW", { isMac: false })).toBe("W");
		expect(formatKeyCode("ShiftLeft", { isMac: true })).toBe("Left ⇧");
		expect(
			formatKeyCode("ShiftRight", { isMac: false, sides: { left: "左 ", right: "右 " } }),
		).toBe("右 Shift");
	});
});

describe("isReservedCombo", () => {
	it("rejects modifier-only, browser shortcuts and (optionally) bare keys", () => {
		expect(isReservedCombo("Shift")).toBe(true);
		expect(isReservedCombo("Mod+W")).toBe(true);
		expect(isReservedCombo("Escape")).toBe(true);
		expect(isReservedCombo("Mod+K")).toBe(false);
		expect(isReservedCombo("K")).toBe(false);
		expect(isReservedCombo("K", { allowBareKeys: false })).toBe(true);
		expect(isReservedCombo("Mod+W", { reserved: [] })).toBe(false);
	});
});

describe("comboFromKeyEvent", () => {
	it("stores the accelerator as mod and shifted symbols by physical key", () => {
		expect(comboFromKeyEvent(keyEvent("z", "KeyZ", { metaKey: true }), { isMac: true })).toBe(
			"mod+z",
		);
		expect(comboFromKeyEvent(keyEvent("z", "KeyZ", { ctrlKey: true }), { isMac: true })).toBe(
			"ctrl+z",
		);
		expect(comboFromKeyEvent(keyEvent("z", "KeyZ", { ctrlKey: true }), { isMac: false })).toBe(
			"mod+z",
		);
		expect(comboFromKeyEvent(keyEvent("!", "Digit1", { shiftKey: true }), { isMac: false })).toBe(
			"1+shift",
		);
		expect(comboFromKeyEvent(keyEvent(" ", "Space"), { isMac: false })).toBe("space");
		expect(comboFromKeyEvent(keyEvent("Shift", "ShiftLeft", { shiftKey: true }))).toBeNull();
	});
});

describe("assignKey / unassignKey", () => {
	const setup = () => {
		const keymap = createKeymap();
		keymap.register({ id: "a", keys: ["K"], onPress: () => {} });
		keymap.register({ id: "b", keys: ["L", "Mod+K"], onPress: () => {} });
		keymap.register({ id: "fixed", keys: ["J"], customizable: false, onPress: () => {} });
		return keymap;
	};

	it("adds, replaces a slot, and keeps one copy of a key", () => {
		const keymap = setup();
		expect(assignKey(keymap, "a", "M").ok).toBe(true);
		expect(keymap.getKeys("a")).toEqual(["K", "M"]);
		assignKey(keymap, "a", "N", { slot: 0 });
		expect(keymap.getKeys("a")).toEqual(["N", "M"]);
		assignKey(keymap, "a", "m", { slot: 0 });
		expect(keymap.getKeys("a")).toEqual(["m"]);
	});

	it("reports or steals overlaps", () => {
		const keymap = setup();
		const shared = assignKey(keymap, "a", "L");
		expect(shared.sharedWith).toEqual(["b"]);
		expect(keymap.getKeys("b")).toEqual(["L", "Mod+K"]);
		const stolen = assignKey(keymap, "a", "L", { steal: true });
		expect(stolen.stolenFrom).toEqual(["b"]);
		expect(keymap.getKeys("b")).toEqual(["Mod+K"]);
		expect(bindingsUsingKey(keymap, "l")).toMatchObject([{ id: "a" }]);
		// Non-customizable bindings keep the key.
		expect(assignKey(keymap, "a", "J", { steal: true }).sharedWith).toEqual(["fixed"]);
	});

	it("refuses non-customizable bindings", () => {
		const keymap = setup();
		expect(assignKey(keymap, "fixed", "Q").ok).toBe(false);
		keymap.setKeys("fixed", ["Q"]);
		expect(keymap.getKeys("fixed")).toEqual(["J"]);
		expect(keymap.get("fixed")).toMatchObject({ customizable: false, overridden: false });
		expect(unassignKey(keymap, "fixed", "J")).toBe(false);
		expect(unassignKey(keymap, "b", "L")).toBe(true);
		expect(keymap.getKeys("b")).toEqual(["Mod+K"]);
	});
});

describe("binding metadata", () => {
	it("snapshots enabled / order / handled, and a listed-only binding doesn't take the key", () => {
		const keymap = createKeymap();
		let canUndo = false;
		keymap.register({
			id: "undo",
			keys: ["Mod+Z"],
			enabled: () => canUndo,
			order: 1,
			onPress: () => {},
		});
		keymap.register({ id: "paste", keys: ["Mod+V"], category: "edit" });
		expect(keymap.get("undo")).toMatchObject({ enabled: false, order: 1, handled: true });
		canUndo = true;
		expect(keymap.get("undo")?.enabled).toBe(true);
		expect(keymap.get("paste")?.handled).toBe(false);
	});
});

describe("bindKeymapStorage", () => {
	const memoryStorage = (initial?: KeymapOverrides) => {
		let value = initial;
		const listeners = new Set<() => void>();
		return {
			load: () => value,
			save: vi.fn((next: KeymapOverrides) => {
				value = next;
			}),
			subscribe(listener: () => void) {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
			external(next: KeymapOverrides | undefined) {
				value = next;
				for (const l of listeners) l();
			},
		};
	};

	it("loads, saves only real changes, and follows external changes", () => {
		const keymap = createKeymap();
		keymap.register({ id: "a", keys: ["K"], onPress: () => {} });
		const storage = memoryStorage({ a: ["M"] });
		const stop = bindKeymapStorage(keymap, storage);
		expect(keymap.getKeys("a")).toEqual(["M"]);
		expect(storage.save).not.toHaveBeenCalled();

		keymap.register({ id: "b", keys: ["L"], onPress: () => {} });
		expect(storage.save).not.toHaveBeenCalled();

		keymap.setKeys("b", null);
		expect(storage.save).toHaveBeenLastCalledWith({ a: ["M"], b: null });

		storage.external({ a: ["N"] });
		expect(keymap.getKeys("a")).toEqual(["N"]);
		expect(keymap.getKeys("b")).toEqual(["L"]);
		expect(storage.save).toHaveBeenCalledTimes(1);

		storage.external(undefined);
		expect(keymap.getKeys("a")).toEqual(["K"]);

		stop();
		keymap.setKeys("a", ["Z"]);
		expect(storage.save).toHaveBeenCalledTimes(1);
	});

	it("keeps rebindings made before binding and saves them with the stored ones", () => {
		const keymap = createKeymap();
		keymap.register({ id: "a", keys: ["K"], onPress: () => {} });
		keymap.register({ id: "b", keys: ["L"], onPress: () => {} });
		keymap.setKeys("a", ["X"]);
		keymap.setKeys("b", ["Y"]);
		const storage = memoryStorage({ b: ["Z"] });
		bindKeymapStorage(keymap, storage);
		expect(keymap.getKeys("a")).toEqual(["X"]);
		expect(keymap.getKeys("b")).toEqual(["Z"]);
		expect(storage.save).toHaveBeenCalledWith({ a: ["X"], b: ["Z"] });
	});

	it("parses untrusted overrides", () => {
		expect(parseKeymapOverrides({ a: ["K"], b: null, c: [1], d: "x" })).toEqual({
			a: ["K"],
			b: null,
		});
		expect(parseKeymapOverrides([])).toBeUndefined();
		expect(parseKeymapOverrides("x")).toBeUndefined();
	});
});
