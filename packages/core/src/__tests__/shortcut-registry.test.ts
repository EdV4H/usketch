import { describe, expect, it, vi } from "vitest";
import { createShortcutRegistry } from "../shortcut-registry.js";

/** Build a minimal KeyboardEvent-like object (handleKeyDown only reads these). */
function keyEvent(
	key: string,
	mods: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "shiftKey" | "altKey">> = {},
): KeyboardEvent {
	return {
		key,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		...mods,
		preventDefault: vi.fn(),
	} as unknown as KeyboardEvent;
}

describe("createShortcutRegistry", () => {
	it("matches a bare key", () => {
		const registry = createShortcutRegistry();
		const cb = vi.fn();
		registry.register("z", cb);
		expect(registry.handleKeyDown(keyEvent("z"))).toBe(true);
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it("`Mod` matches both Cmd (mac) and Ctrl (win)", () => {
		const registry = createShortcutRegistry();
		const cb = vi.fn();
		registry.register("Mod+Z", cb);
		// win: Ctrl+Z
		expect(registry.handleKeyDown(keyEvent("z", { ctrlKey: true }))).toBe(true);
		// mac: Cmd+Z
		expect(registry.handleKeyDown(keyEvent("z", { metaKey: true }))).toBe(true);
		expect(cb).toHaveBeenCalledTimes(2);
	});

	it("is order-independent and case-insensitive", () => {
		const registry = createShortcutRegistry();
		const cb = vi.fn();
		registry.register("Shift+Mod+Z", cb);
		expect(registry.handleKeyDown(keyEvent("z", { metaKey: true, shiftKey: true }))).toBe(true);
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it("returns false when no combo matches", () => {
		const registry = createShortcutRegistry();
		registry.register("Mod+Z", vi.fn());
		expect(registry.handleKeyDown(keyEvent("z"))).toBe(false);
	});

	it("preventDefault is called only on a match", () => {
		const registry = createShortcutRegistry();
		registry.register("Mod+Z", vi.fn());
		const matched = keyEvent("z", { metaKey: true });
		registry.handleKeyDown(matched);
		expect(matched.preventDefault).toHaveBeenCalledTimes(1);
		const unmatched = keyEvent("q", { metaKey: true });
		registry.handleKeyDown(unmatched);
		expect(unmatched.preventDefault).not.toHaveBeenCalled();
	});

	it("unregister removes the shortcut", () => {
		const registry = createShortcutRegistry();
		const cb = vi.fn();
		const off = registry.register("Mod+Z", cb);
		off();
		expect(registry.handleKeyDown(keyEvent("z", { metaKey: true }))).toBe(false);
		expect(cb).not.toHaveBeenCalled();
	});

	it("list() returns the original combo + metadata", () => {
		const registry = createShortcutRegistry();
		registry.register("Mod+Z", vi.fn(), { label: "Undo", category: "history" });
		registry.register("Mod+A", vi.fn());
		const list = registry.list();
		expect(list).toContainEqual({
			combo: "Mod+Z",
			meta: { label: "Undo", category: "history" },
		});
		expect(list).toContainEqual({ combo: "Mod+A" });
	});
});
