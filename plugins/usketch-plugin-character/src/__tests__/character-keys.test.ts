import { describe, expect, it } from "vitest";
import {
	actionOfKey,
	bindKey,
	canBindKey,
	KEYS_STORAGE_KEY,
	type KeyStorage,
	keyLabel,
	loadStoredKeys,
	parseStoredKeys,
	saveStoredKeys,
	unbindKey,
	unboundDirections,
} from "../character-keys.js";
import { type CharacterKeys, DEFAULT_KEYS } from "../character-types.js";

function memoryStorage(): KeyStorage & { data: Map<string, string> } {
	const data = new Map<string, string>();
	return {
		data,
		getItem: (k) => data.get(k) ?? null,
		setItem: (k, v) => void data.set(k, v),
		removeItem: (k) => void data.delete(k),
	};
}

describe("keyLabel", () => {
	it("shows codes the way the keycap reads", () => {
		expect(keyLabel("KeyW")).toBe("W");
		expect(keyLabel("Digit3")).toBe("3");
		expect(keyLabel("ArrowUp")).toBe("↑");
		expect(keyLabel("ShiftLeft")).toBe("左 Shift");
		expect(keyLabel("Numpad8")).toBe("テンキー 8");
		expect(keyLabel("F5")).toBe("F5");
	});
});

describe("canBindKey", () => {
	it("refuses Esc, Tab and lone modifiers", () => {
		for (const code of ["Escape", "Tab", "ControlLeft", "AltRight", "MetaLeft", ""]) {
			expect(canBindKey(code, "jump")).toBe(false);
		}
	});

	it("allows Shift only for the jump and the drift", () => {
		expect(canBindKey("ShiftLeft", "drift")).toBe(true);
		expect(canBindKey("ShiftRight", "jump")).toBe(true);
		expect(canBindKey("ShiftLeft", "up")).toBe(false);
		expect(canBindKey("KeyI", "up")).toBe(true);
	});
});

describe("bindKey / unbindKey", () => {
	it("replaces a slot or appends past the end", () => {
		const k1 = bindKey(DEFAULT_KEYS, "up", 0, "KeyI");
		expect(k1.up).toEqual(["KeyI"]);
		const k2 = bindKey(k1, "up", 1, "ArrowUp");
		expect(k2.up).toEqual(["KeyI", "ArrowUp"]);
		expect(bindKey(k1, "up", 9, "ArrowUp").up).toEqual(["KeyI", "ArrowUp"]);
	});

	it("moves a key off the action that had it", () => {
		const k = bindKey(DEFAULT_KEYS, "jump", 0, "KeyW");
		expect(k.jump).toEqual(["KeyW"]);
		expect(k.up).toEqual([]);
		expect(unboundDirections(k)).toEqual(["up"]);
		expect(actionOfKey(k, "KeyW")).toBe("jump");
	});

	it("doesn't duplicate a key within one action", () => {
		const keys: CharacterKeys = { ...DEFAULT_KEYS, up: ["KeyW", "ArrowUp"] };
		expect(bindKey(keys, "up", 0, "ArrowUp").up).toEqual(["ArrowUp"]);
	});

	it("leaves the keys alone for a refused key", () => {
		expect(bindKey(DEFAULT_KEYS, "up", 0, "Escape")).toBe(DEFAULT_KEYS);
	});

	it("removes a slot", () => {
		expect(unbindKey(DEFAULT_KEYS, "drift", 0).drift).toEqual(["ShiftRight"]);
		expect(unbindKey(DEFAULT_KEYS, "drift", 5)).toBe(DEFAULT_KEYS);
	});
});

describe("stored keys", () => {
	it("round-trips through storage over the host's keys", () => {
		const storage = memoryStorage();
		expect(loadStoredKeys(storage, DEFAULT_KEYS)).toBeNull();
		const mine = bindKey(DEFAULT_KEYS, "jump", 0, "KeyJ");
		saveStoredKeys(storage, mine);
		expect(storage.data.has(KEYS_STORAGE_KEY)).toBe(true);
		expect(loadStoredKeys(storage, DEFAULT_KEYS)).toEqual(mine);
		saveStoredKeys(storage, null);
		expect(loadStoredKeys(storage, DEFAULT_KEYS)).toBeNull();
	});

	it("keeps base for missing / junk actions and drops refused or repeated keys", () => {
		const keys = parseStoredKeys(
			{ up: ["KeyI", 3, "Escape"], down: "nope", jump: ["KeyI", "KeyK"], drift: ["ShiftLeft"] },
			DEFAULT_KEYS,
		);
		expect(keys).toEqual({
			...DEFAULT_KEYS,
			up: ["KeyI"],
			jump: ["KeyK"],
			drift: ["ShiftLeft"],
		});
		expect(parseStoredKeys(null, DEFAULT_KEYS)).toBeNull();
		expect(parseStoredKeys([1], DEFAULT_KEYS)).toBeNull();
	});

	it("survives unreadable storage", () => {
		const broken: KeyStorage = {
			getItem: () => {
				throw new Error("blocked");
			},
			setItem: () => {
				throw new Error("quota");
			},
			removeItem: () => {},
		};
		expect(loadStoredKeys(broken, DEFAULT_KEYS)).toBeNull();
		expect(() => saveStoredKeys(broken, DEFAULT_KEYS)).not.toThrow();
		const storage = memoryStorage();
		storage.setItem(KEYS_STORAGE_KEY, "{not json");
		expect(loadStoredKeys(storage, DEFAULT_KEYS)).toBeNull();
	});
});
