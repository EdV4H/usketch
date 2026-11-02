import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	collapseAll,
	createDockPrefsStore,
	DEFAULT_DOCK_PREFS,
	parseDockPrefs,
	toggleOpen,
	togglePinned,
} from "../dock-prefs-store.js";

describe("dock prefs reducers", () => {
	it("toggleOpen adds and removes a key", () => {
		const a = toggleOpen(DEFAULT_DOCK_PREFS, "map");
		expect(a.open).toEqual(["@tools", "map"]);
		expect(toggleOpen(a, "map").open).toEqual(["@tools"]);
	});

	it("togglePinned pins in order and opens the section", () => {
		let p = togglePinned(DEFAULT_DOCK_PREFS, "map");
		p = togglePinned(p, "snap");
		expect(p.pinned).toEqual(["map", "snap"]);
		expect(p.open).toEqual(["@tools", "map", "snap"]);
	});

	it("unpinning keeps the open state", () => {
		const p = togglePinned(togglePinned(DEFAULT_DOCK_PREFS, "map"), "map");
		expect(p.pinned).toEqual([]);
		expect(p.open).toContain("map");
	});

	it("collapseAll closes only the given keys and keeps pins", () => {
		const p = togglePinned(toggleOpen(DEFAULT_DOCK_PREFS, "snap"), "map");
		const c = collapseAll(p, ["map", "snap"]);
		expect(c.open).toEqual(["@tools"]);
		expect(c.pinned).toEqual(["map"]);
	});
});

describe("parseDockPrefs", () => {
	it("falls back to defaults for missing / broken values", () => {
		expect(parseDockPrefs(null)).toBe(DEFAULT_DOCK_PREFS);
		expect(parseDockPrefs("{not json")).toBe(DEFAULT_DOCK_PREFS);
		expect(parseDockPrefs("42")).toBe(DEFAULT_DOCK_PREFS);
	});

	it("keeps only unique strings", () => {
		expect(parseDockPrefs(JSON.stringify({ open: ["a", 1, "a", "b"], pinned: "x" }))).toEqual({
			open: ["a", "b"],
			pinned: [],
		});
	});
});

describe("createDockPrefsStore", () => {
	let storage: Map<string, string>;
	beforeEach(() => {
		storage = new Map();
		vi.stubGlobal("localStorage", {
			getItem: (k: string) => storage.get(k) ?? null,
			setItem: (k: string, v: string) => storage.set(k, v),
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it("persists updates and notifies listeners", () => {
		const store = createDockPrefsStore("k");
		const listener = vi.fn();
		store.subscribe(listener);
		store.update((p) => togglePinned(p, "map"));
		expect(listener).toHaveBeenCalledTimes(1);
		expect(createDockPrefsStore("k").get().pinned).toEqual(["map"]);
	});

	it("skips notify when the reducer returns the same object", () => {
		const store = createDockPrefsStore("k");
		const listener = vi.fn();
		store.subscribe(listener);
		store.update((p) => p);
		expect(listener).not.toHaveBeenCalled();
	});
});
