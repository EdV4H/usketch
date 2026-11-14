import { createKeymap } from "@edv4h/usketch-core";
import type { KeyBindingSpec } from "@edv4h/usketch-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureKeys } from "../key-capture.js";
import { applyPickedKey, bindingName, groupBindings, sharersOf } from "../key-settings-model.js";

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
		repeat: false,
		...mods,
		preventDefault: vi.fn(),
		stopImmediatePropagation: vi.fn(),
	} as unknown as KeyboardEvent;
}

/** A keymap with bindings owned by plugins (as `ctx.keymap` attributes them). */
function setup() {
	const keymap = createKeymap({ isMac: false });
	const own = (pluginId: string, index: number, spec: KeyBindingSpec) =>
		keymap.registerFor({ pluginId, index }, spec);
	own("character", 0, { id: "character:up", kind: "hold", keys: ["KeyW"], label: "上", order: 0 });
	own("character", 0, {
		id: "character:jump",
		kind: "hold",
		keys: ["Space"],
		label: "ジャンプ",
		order: 2,
	});
	own("character", 0, {
		id: "character:left",
		kind: "hold",
		keys: ["KeyA"],
		label: "左",
		order: 1,
	});
	own("tools", 1, {
		id: "tools:tool:wire",
		keys: ["w"],
		label: "Wire",
		category: "tool",
		onPress: () => {},
	});
	own("export", 2, { id: "export:png", keys: ["Mod+Shift+E"], onPress: () => {} });
	own("fixed", 3, { id: "fixed:help", keys: ["?"], customizable: false, onPress: () => {} });
	return keymap;
}

const names: Record<string, string> = { character: "キャラクター", export: "書き出し" };
const pluginName = (id: string | undefined) => (id ? names[id] : undefined);

describe("groupBindings", () => {
	it("groups by category, else plugin name, and sorts by order", () => {
		const keymap = setup();
		const groups = groupBindings(keymap.getAll(), pluginName);
		expect(groups.map((g) => g.title)).toEqual(["キャラクター", "ツール", "書き出し", "fixed"]);
		expect(groups[0]?.bindings.map(bindingName)).toEqual(["上", "左", "ジャンプ"]);
		expect(groups[2]?.bindings.map(bindingName)).toEqual(["png"]);
	});

	it("filters by name, group or key", () => {
		const keymap = setup();
		expect(groupBindings(keymap.getAll(), pluginName, "ジャンプ")).toHaveLength(1);
		expect(
			groupBindings(keymap.getAll(), pluginName, "keyw")[0]?.bindings.map((b) => b.id),
		).toEqual(["character:up"]);
	});
});

describe("applyPickedKey", () => {
	it("binds a held key by code and reports overlaps with other plugins", () => {
		const keymap = setup();
		const result = applyPickedKey(keymap, "character:jump", 0, keyEvent("w", "KeyW"));
		expect(result.type).toBe("assigned");
		// Moved off the character's own "up"; the tool keeps "w" and shares it.
		expect(keymap.getKeys("character:up")).toEqual([]);
		expect(keymap.getKeys("character:jump")).toEqual(["KeyW"]);
		if (result.type === "assigned") {
			expect(result.movedFrom.map((b) => b.id)).toEqual(["character:up"]);
			expect(result.sharedWith.map((b) => b.id)).toEqual(["tools:tool:wire"]);
		}
		const jump = keymap.get("character:jump");
		expect(jump && sharersOf(keymap, jump, "KeyW").map((b) => b.id)).toEqual(["tools:tool:wire"]);
	});

	it("reads press combos with mod and adds into a new slot", () => {
		const keymap = setup();
		const r = applyPickedKey(keymap, "export:png", 1, keyEvent("p", "KeyP", { ctrlKey: true }));
		expect(r.type).toBe("assigned");
		expect(keymap.getKeys("export:png")).toEqual(["Mod+Shift+E", "mod+p"]);
	});

	it("waits on modifiers, cancels on Esc, removes on Delete, refuses reserved keys", () => {
		const keymap = setup();
		expect(
			applyPickedKey(keymap, "export:png", 0, keyEvent("Control", "ControlLeft", { ctrlKey: true }))
				.type,
		).toBe("wait");
		expect(applyPickedKey(keymap, "export:png", 0, keyEvent("Escape", "Escape")).type).toBe(
			"cancel",
		);
		expect(
			applyPickedKey(keymap, "export:png", 0, keyEvent("w", "KeyW", { ctrlKey: true })).type,
		).toBe("refused");
		expect(applyPickedKey(keymap, "character:up", 0, keyEvent("Tab", "Tab")).type).toBe("refused");
		expect(applyPickedKey(keymap, "fixed:help", 0, keyEvent("h", "KeyH")).type).toBe("refused");
		expect(applyPickedKey(keymap, "character:up", 0, keyEvent("Delete", "Delete")).type).toBe(
			"removed",
		);
		expect(keymap.getKeys("character:up")).toEqual([]);
		expect(keymap.getOverrides()).toEqual({ "character:up": [] });
	});
});

describe("captureKeys", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("blocks every binding while picking, swallows the key and its keyup, and restores the gate", () => {
		// A minimal window: listeners in order, stopImmediatePropagation honoured.
		const listeners: { type: string; fn: (e: unknown) => void }[] = [];
		vi.stubGlobal("window", {
			addEventListener: (type: string, fn: (e: unknown) => void) => listeners.push({ type, fn }),
			removeEventListener: (type: string, fn: (e: unknown) => void) => {
				const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
				if (i >= 0) listeners.splice(i, 1);
			},
		});
		const fire = (type: string, code: string) => {
			let stopped = false;
			const e = {
				...keyEvent(code, code),
				stopImmediatePropagation: () => {
					stopped = true;
				},
			};
			for (const l of [...listeners]) {
				if (stopped) break;
				if (l.type === type) l.fn(e);
			}
		};
		const keymap = setup();
		const got: string[] = [];
		const resolved: number[] = [];
		const stop = captureKeys(keymap, (e) => {
			got.push(e.code);
			resolved.push(keymap.resolveAll(e).length);
			return e.code !== "ShiftLeft";
		});
		const after = vi.fn();
		listeners.push({ type: "keydown", fn: after }, { type: "keyup", fn: after });
		fire("keydown", "ShiftLeft");
		fire("keydown", "KeyW");
		expect(got).toEqual(["ShiftLeft", "KeyW"]);
		// While picking, the keymap gave W (the character's "up") to no one.
		expect(resolved).toEqual([0, 0]);
		expect(after).not.toHaveBeenCalled();
		expect(keymap.getGate()).toBeNull();
		expect(keymap.resolveAll(keyEvent("w", "KeyW")).length).toBeGreaterThan(0);
		fire("keyup", "KeyW");
		fire("keyup", "ShiftLeft");
		expect(after).not.toHaveBeenCalled();
		fire("keydown", "KeyW");
		expect(after).toHaveBeenCalledTimes(1);
		stop();
	});
});
