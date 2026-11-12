import type { BoardStore, KeyConflictPolicy, UsketchPlugin } from "@edv4h/usketch-shared";
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
		expect(normalizeCombo("Shift+Mod+Z")).toBe("mod+shift+z");
		expect(normalizeCombo("Cmd+Option+K")).toBe("alt+k+meta");
		expect(normalizeCombo("?")).toBe("/+shift");
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

describe("Mod / physical keys / gate / IME", () => {
	it('"platform" mode: Mod is Cmd on macOS and Ctrl elsewhere', () => {
		const mac = createKeymap({ isMac: true });
		const win = createKeymap({ isMac: false });
		const onMac = vi.fn();
		const onWin = vi.fn();
		mac.register({ id: "u", keys: ["Mod+Z"], onPress: onMac });
		win.register({ id: "u", keys: ["Mod+Z"], onPress: onWin });
		expect(mac.handleKeyDown(keyEvent("z", "KeyZ", { metaKey: true }))).toBe(true);
		expect(mac.handleKeyDown(keyEvent("z", "KeyZ", { ctrlKey: true }))).toBe(false);
		expect(win.handleKeyDown(keyEvent("z", "KeyZ", { ctrlKey: true }))).toBe(true);
		expect(win.handleKeyDown(keyEvent("z", "KeyZ", { metaKey: true }))).toBe(false);
		expect([onMac.mock.calls.length, onWin.mock.calls.length]).toEqual([1, 1]);
	});

	it('"either" mode: Cmd and Ctrl both act as Mod', () => {
		const keymap = createKeymap({ mod: "either", isMac: true });
		const cb = vi.fn();
		keymap.register({ id: "u", keys: ["Mod+Z"], onPress: cb });
		keymap.handleKeyDown(keyEvent("z", "KeyZ", { metaKey: true }));
		keymap.handleKeyDown(keyEvent("z", "KeyZ", { ctrlKey: true }));
		expect(cb).toHaveBeenCalledTimes(2);
	});

	it("matches shifted symbols by physical key, and `?` as Shift+/", () => {
		const keymap = createKeymap({ isMac: false });
		const fit = vi.fn();
		const front = vi.fn();
		const help = vi.fn();
		keymap.register({ id: "fit", keys: ["Shift+1"], onPress: fit });
		keymap.register({ id: "front", keys: ["Mod+Shift+]"], onPress: front });
		keymap.register({ id: "help", keys: ["?"], onPress: help });
		keymap.handleKeyDown(keyEvent("!", "Digit1", { shiftKey: true }));
		keymap.handleKeyDown(keyEvent("}", "BracketRight", { shiftKey: true, ctrlKey: true }));
		keymap.handleKeyDown(keyEvent("?", "Slash", { shiftKey: true }));
		expect([fit, front, help].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
	});

	it("keeps plain letters on the layout's key (AZERTY's A key types `q`)", () => {
		const keymap = createKeymap();
		const q = vi.fn();
		const a = vi.fn();
		keymap.register({ id: "q", keys: ["q"], onPress: q });
		keymap.register({ id: "a", keys: ["a"], onPress: a });
		keymap.handleKeyDown(keyEvent("q", "KeyA"));
		expect([q.mock.calls.length, a.mock.calls.length]).toEqual([1, 0]);
	});

	it("the host gate can block bindings (press and hold)", () => {
		const cb = vi.fn();
		const keymap = createKeymap({ gate: (b) => b.id.startsWith("host:") });
		keymap.register({ id: "host:x", keys: ["x"], onPress: cb });
		keymap.register({ id: "plugin:y", keys: ["y"], onPress: cb });
		keymap.register({ id: "plugin:w", kind: "hold", keys: ["KeyW"] });
		expect(keymap.handleKeyDown(keyEvent("x", "KeyX"))).toBe(true);
		expect(keymap.handleKeyDown(keyEvent("y", "KeyY"))).toBe(false);
		expect(keymap.claims("plugin:w", keyEvent("w", "KeyW"))).toBe(false);
		keymap.setGate(null);
		expect(keymap.handleKeyDown(keyEvent("y", "KeyY"))).toBe(true);
		expect(keymap.claims("plugin:w", keyEvent("w", "KeyW"))).toBe(true);
	});

	it("ignores keys typed into an IME composition", () => {
		const keymap = createKeymap();
		const cb = vi.fn();
		keymap.register({ id: "x", keys: ["x"], onPress: cb });
		const e = { ...keyEvent("x", "KeyX"), isComposing: true } as KeyboardEvent;
		expect(keymap.handleKeyDown(e)).toBe(false);
		expect(cb).not.toHaveBeenCalled();
	});

	it("normalizeKey names keys the way conflicts do", () => {
		const keymap = createKeymap({ isMac: true });
		expect(keymap.normalizeKey("Mod+Shift+Z")).toBe("meta+shift+z");
		expect(keymap.normalizeKey("ShiftLeft", "hold")).toBe("shift");
	});
});

describe("conflict policies", () => {
	const setup = (conflictPolicy?: KeyConflictPolicy) => {
		const keymap = createKeymap(conflictPolicy ? { conflictPolicy } : {});
		const a = vi.fn();
		const b = vi.fn();
		keymap.registerFor({ pluginId: "a", index: 0 }, { id: "a:x", keys: ["x"], onPress: a });
		keymap.registerFor({ pluginId: "b", index: 1 }, { id: "b:x", keys: ["x"], onPress: b });
		return { keymap, a, b };
	};
	const x = () => keyEvent("x", "KeyX");

	it('"first" (default) gives the key to the earlier plugin', () => {
		const { keymap, a, b } = setup();
		keymap.handleKeyDown(x());
		expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 0]);
		expect(keymap.getConflicts()[0]?.bindings.map((bd) => bd.id)).toEqual(["a:x", "b:x"]);
	});

	it('"last" gives the key to the later plugin and lists it first', () => {
		const { keymap, a, b } = setup("last");
		keymap.handleKeyDown(x());
		expect([a.mock.calls.length, b.mock.calls.length]).toEqual([0, 1]);
		expect(keymap.getConflicts()[0]?.bindings.map((bd) => bd.id)).toEqual(["b:x", "a:x"]);
	});

	it('"all" runs every active binding; hold bindings all claim', () => {
		const { keymap, a, b } = setup("all");
		keymap.register({ id: "c:x", kind: "hold", keys: ["KeyX"] });
		expect(keymap.handleKeyDown(x())).toBe(true);
		expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
		expect(keymap.claims("c:x", x())).toBe(true);
		expect(keymap.resolveAll(x()).map((bd) => bd.id)).toEqual(["c:x", "a:x", "b:x"]);
	});

	it("a custom policy picks the subset (and order) that acts", () => {
		const { keymap, a, b } = setup((candidates) => candidates.filter((c) => c.pluginId === "b"));
		keymap.handleKeyDown(x());
		expect([a.mock.calls.length, b.mock.calls.length]).toEqual([0, 1]);

		keymap.setConflictPolicy(() => []);
		expect(keymap.handleKeyDown(x())).toBe(false);

		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		keymap.setConflictPolicy(() => {
			throw new Error("boom");
		});
		keymap.handleKeyDown(x());
		expect(a).toHaveBeenCalledTimes(1);
		err.mockRestore();
	});

	it("setConflictPolicy switches at runtime and notifies", () => {
		const { keymap, a, b } = setup();
		const listener = vi.fn();
		keymap.subscribe(listener);
		keymap.setConflictPolicy("last");
		expect(keymap.getConflictPolicy()).toBe("last");
		expect(listener).toHaveBeenCalledTimes(1);
		keymap.handleKeyDown(x());
		expect([a.mock.calls.length, b.mock.calls.length]).toEqual([0, 1]);
	});

	it("priority still comes before the policy's tie-break", () => {
		const { keymap, a } = setup("last");
		keymap.registerFor(
			{ pluginId: "a", index: 0 },
			{
				id: "a:x",
				keys: ["x"],
				onPress: a,
				priority: 5,
			},
		);
		keymap.handleKeyDown(x());
		expect(a).toHaveBeenCalledTimes(1);
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
