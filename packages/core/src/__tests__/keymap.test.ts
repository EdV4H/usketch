import type { BoardStore, UsketchPlugin } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../create-app.js";
import { codeToKey, createKeymap, normalizeCombo } from "../keymap.js";

function keyEvent(
	key: string,
	code = "",
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
		preventDefault: vi.fn(),
	} as unknown as KeyboardEvent;
}

describe("normalizeCombo / codeToKey", () => {
	it("normalizes combos and codes to the same key names", () => {
		expect(normalizeCombo("Shift+Mod+Z")).toBe("ctrl+shift+z");
		expect(normalizeCombo("Space")).toBe("space");
		expect(codeToKey("KeyW")).toBe("w");
		expect(codeToKey("Digit3")).toBe("3");
		expect(codeToKey("ShiftLeft")).toBe("shift");
		expect(codeToKey("ShiftRight")).toBe("shift");
		expect(codeToKey("Space")).toBe("space");
		expect(codeToKey("ArrowUp")).toBe("arrowup");
	});
});

describe("createKeymap", () => {
	it("dispatches a press binding and matches Space by name", () => {
		const keymap = createKeymap();
		const onPress = vi.fn();
		keymap.register({ id: "a:jump", keys: ["Space"], onPress });
		expect(keymap.handleKeyDown(keyEvent(" ", "Space"))).toBe(true);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("reports overlapping keys across press and hold bindings, winner first", () => {
		const keymap = createKeymap();
		keymap.registerFor(
			{ pluginId: "char", index: 1 },
			{
				id: "char:drift",
				kind: "hold",
				keys: ["ShiftLeft", "ShiftRight"],
			},
		);
		keymap.registerFor(
			{ pluginId: "mode7", index: 0 },
			{
				id: "mode7:camera-down",
				kind: "hold",
				keys: ["ShiftLeft", "ShiftRight"],
			},
		);
		keymap.registerFor({ pluginId: "sticky", index: 2 }, { id: "sticky:tool", keys: ["s"] });
		keymap.registerFor(
			{ pluginId: "char", index: 1 },
			{
				id: "char:down",
				kind: "hold",
				keys: ["KeyS"],
			},
		);
		keymap.registerFor({ pluginId: "card", index: 3 }, { id: "card:shuffle", keys: ["Shift+S"] });

		const conflicts = keymap.getConflicts();
		expect(conflicts.map((c) => c.key)).toEqual(["s", "shift"]);
		const shift = conflicts.find((c) => c.key === "shift");
		// mode7 is earlier in the plugin list, so it wins ties.
		expect(shift?.bindings.map((b) => b.id)).toEqual(["mode7:camera-down", "char:drift"]);
		const s = conflicts.find((c) => c.key === "s");
		expect(s?.bindings.map((b) => b.id)).toEqual(["char:down", "sticky:tool"]);
	});

	it("gives the key to the binding whose `when` holds, then priority, then plugin order", () => {
		const keymap = createKeymap();
		let driving = false;
		const tool = vi.fn();
		keymap.registerFor(
			{ pluginId: "sticky", index: 0 },
			{
				id: "sticky:tool",
				keys: ["s"],
				onPress: tool,
			},
		);
		keymap.registerFor(
			{ pluginId: "char", index: 1 },
			{
				id: "char:down",
				kind: "hold",
				keys: ["KeyS"],
				when: () => driving,
			},
		);

		const e = () => keyEvent("s", "KeyS");
		// Not driving: the tool owns `s`.
		expect(keymap.claims("char:down", e())).toBe(false);
		expect(keymap.handleKeyDown(e())).toBe(true);
		expect(tool).toHaveBeenCalledTimes(1);

		// Driving, but the tool's plugin comes first: the tool still wins…
		driving = true;
		expect(keymap.resolve(e())?.id).toBe("sticky:tool");

		// …until the hold binding outranks it. Then the host leaves the key to it.
		keymap.registerFor(
			{ pluginId: "char", index: 1 },
			{
				id: "char:down",
				kind: "hold",
				keys: ["KeyS"],
				when: () => driving,
				priority: 10,
			},
		);
		expect(keymap.claims("char:down", e())).toBe(true);
		expect(keymap.handleKeyDown(e())).toBe(false);
		expect(tool).toHaveBeenCalledTimes(1);
	});

	it("treats a throwing `when` as inactive", () => {
		const keymap = createKeymap();
		keymap.register({
			id: "x:boom",
			keys: ["q"],
			when: () => {
				throw new Error("boom");
			},
			onPress: vi.fn(),
		});
		expect(keymap.handleKeyDown(keyEvent("q", "KeyQ"))).toBe(false);
	});

	it("does not match Shift+S to a bare `s` (tool keys ignore chords)", () => {
		const keymap = createKeymap();
		const tool = vi.fn();
		const shuffle = vi.fn();
		keymap.register({ id: "sticky:tool", keys: ["s"], onPress: tool });
		keymap.register({ id: "card:shuffle", keys: ["Shift+S"], onPress: shuffle });
		keymap.handleKeyDown(keyEvent("S", "KeyS", { shiftKey: true }));
		expect(shuffle).toHaveBeenCalledTimes(1);
		expect(tool).not.toHaveBeenCalled();
	});

	it("applies host defaults, then viewer overrides; resets back", () => {
		const keymap = createKeymap({
			keys: { "mode7:camera-down": ["KeyQ"], "mode7:camera-up": null },
			overrides: { "char:drift": ["KeyE"] },
		});
		const listener = vi.fn();
		keymap.subscribe(listener);
		keymap.register({ id: "mode7:camera-down", kind: "hold", keys: ["ShiftLeft"] });
		keymap.register({ id: "mode7:camera-up", kind: "hold", keys: ["Space"] });
		keymap.register({ id: "char:drift", kind: "hold", keys: ["ShiftLeft"] });

		expect(keymap.getKeys("mode7:camera-down")).toEqual(["KeyQ"]);
		expect(keymap.getKeys("mode7:camera-up")).toEqual([]);
		expect(keymap.get("char:drift")).toMatchObject({
			keys: ["KeyE"],
			defaultKeys: ["ShiftLeft"],
			overridden: true,
		});
		expect(keymap.getConflicts()).toEqual([]);

		keymap.setKeys("mode7:camera-down", null);
		expect(keymap.getKeys("mode7:camera-down")).toEqual([]);
		expect(keymap.getOverrides()).toEqual({ "char:drift": ["KeyE"], "mode7:camera-down": null });

		keymap.resetKeys();
		expect(keymap.getKeys("mode7:camera-down")).toEqual(["KeyQ"]);
		expect(keymap.getKeys("char:drift")).toEqual(["ShiftLeft"]);
		expect(listener).toHaveBeenCalled();
	});

	it("keeps a newer registration when an older one with the same id is unregistered", () => {
		const keymap = createKeymap();
		const first = vi.fn();
		const second = vi.fn();
		const offFirst = keymap.register({ id: "p:x", keys: ["x"], onPress: first });
		keymap.register({ id: "p:x", keys: ["x"], onPress: second });
		offFirst();
		keymap.handleKeyDown(keyEvent("x", "KeyX"));
		expect(second).toHaveBeenCalledTimes(1);
		expect(first).not.toHaveBeenCalled();
	});
});

describe("createApp keymap wiring", () => {
	const store = { setActiveToolId: vi.fn(), onMutation: () => () => {} } as unknown as BoardStore;

	it("attributes shortcuts and tool keys to plugins and ranks them by plugin order", async () => {
		const toolPlugin: UsketchPlugin = {
			id: "tool-plugin",
			name: "Tool",
			setup(ctx) {
				ctx.tools.register("frame", { icon: () => null as never, shortcut: "f", label: "Frame" });
			},
		};
		const follow = vi.fn();
		const followPlugin: UsketchPlugin = {
			id: "follow-plugin",
			name: "Follow",
			setup(ctx) {
				ctx.shortcuts.register("f", follow, { label: "Follow" });
			},
		};
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const app = await createApp({
			store,
			plugins: [toolPlugin, followPlugin],
			keymap: { warnConflicts: true },
		});

		const conflicts = app.keymap.getConflicts();
		expect(conflicts).toHaveLength(1);
		expect(conflicts[0]?.bindings.map((b) => [b.id, b.pluginId])).toEqual([
			["tool-plugin:tool:frame", "tool-plugin"],
			["follow-plugin:shortcut:f", "follow-plugin"],
		]);
		expect(warn).toHaveBeenCalledTimes(1);
		warn.mockRestore();

		// The tool plugin is listed first, so `f` activates the tool.
		app.shortcuts.handleKeyDown(keyEvent("f", "KeyF"));
		expect(store.setActiveToolId).toHaveBeenCalledWith("frame");
		expect(follow).not.toHaveBeenCalled();

		// Rebinding the tool frees `f` for the follow shortcut.
		app.keymap.setKeys("tool-plugin:tool:frame", ["Shift+F"]);
		expect(app.keymap.getConflicts()).toEqual([]);
		app.shortcuts.handleKeyDown(keyEvent("f", "KeyF"));
		expect(follow).toHaveBeenCalledTimes(1);

		// Core undo/redo are listed through the shortcuts API.
		expect(app.shortcuts.list().map((s) => s.combo)).toEqual(
			expect.arrayContaining(["Mod+Z", "Mod+Shift+Z", "f"]),
		);
		app.destroy();
	});
});
