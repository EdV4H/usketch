import { describe, expect, it, vi } from "vitest";
import {
	createGroundDecalRegistry,
	decalRectsMeet,
	type GroundDecal,
	type GroundDecalRect,
	groundDecalService,
	groundDecals,
} from "../ground-decal.js";
import type { ServiceRegistry } from "../types/plugin.js";

function fakeServices(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide: <T>(key: string, service: T) => {
			map.set(key, service);
			return () => {
				if (map.get(key) === service) map.delete(key);
			};
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key: string) => map.has(key),
	};
}

const rect = (left: number, top: number, right: number, bottom: number): GroundDecalRect => ({
	left,
	top,
	right,
	bottom,
});

const decal = (extra: Partial<GroundDecal> = {}): GroundDecal => ({ paint: () => {}, ...extra });

describe("decalRectsMeet", () => {
	it("overlap, touching edges, and null meaning everywhere", () => {
		expect(decalRectsMeet(rect(0, 0, 10, 10), rect(5, 5, 20, 20))).toBe(true);
		expect(decalRectsMeet(rect(0, 0, 10, 10), rect(10, 0, 20, 10))).toBe(false);
		expect(decalRectsMeet(rect(0, 0, 10, 10), rect(0, 20, 10, 30))).toBe(false);
		expect(decalRectsMeet(null, rect(0, 20, 10, 30))).toBe(true);
	});
});

describe("ground decal registry", () => {
	it("lists decals by order, then id", () => {
		const r = createGroundDecalRegistry();
		r.set("b", decal());
		r.set("a", decal());
		r.set("under", decal({ order: -1 }));
		expect(r.list().map((e) => e.id)).toEqual(["under", "a", "b"]);
	});

	it("listFor filters by view and bounds (no bounds = everywhere, default views = both)", () => {
		const r = createGroundDecalRegistry();
		r.set("anywhere", decal());
		r.set("left", decal({ bounds: () => rect(0, 0, 100, 100) }));
		r.set("only3d", decal({ views: ["3d"] }));
		expect(r.listFor("flat", rect(500, 500, 600, 600)).map((e) => e.id)).toEqual(["anywhere"]);
		expect(r.listFor("3d", rect(50, 50, 60, 60)).map((e) => e.id)).toEqual([
			"anywhere",
			"left",
			"only3d",
		]);
	});

	it("reads bounds on set / invalidate only, and repaints where moved bounds were and are", () => {
		const r = createGroundDecalRegistry();
		let b = rect(0, 0, 10, 10);
		const bounds = vi.fn(() => b);
		r.set("d", decal({ bounds }));
		r.listFor("flat", rect(0, 0, 5, 5));
		r.listFor("3d", rect(0, 0, 5, 5));
		expect(bounds).toHaveBeenCalledTimes(1);
		// Moved without telling: still the cached bounds.
		b = rect(100, 100, 110, 110);
		expect(r.listFor("flat", rect(100, 100, 105, 105))).toHaveLength(0);
		const v = r.version();
		r.invalidate("d", rect(100, 100, 101, 101));
		expect(bounds).toHaveBeenCalledTimes(2);
		expect(r.listFor("flat", rect(100, 100, 105, 105))).toHaveLength(1);
		// The old place repaints too (a tile there must drop it), not just the given rect.
		expect(r.changedSince(v, "flat", rect(1, 1, 2, 2))).toBe(true);
	});

	it("treats broken bounds as everywhere", () => {
		const r = createGroundDecalRegistry();
		r.set("nan", decal({ bounds: () => rect(Number.NaN, 0, 1, 1) }));
		r.set("inverted", decal({ bounds: () => rect(10, 0, 0, 1) }));
		expect(r.listFor("flat", rect(1000, 1000, 1001, 1001))).toHaveLength(2);
	});

	it("changedSince: only changes on that view and area after the version count", () => {
		const r = createGroundDecalRegistry();
		r.set("course", decal({ bounds: () => rect(0, 0, 100, 100), views: ["3d"] }));
		const v = r.version();
		expect(r.changedSince(v, "3d", rect(0, 0, 10, 10))).toBe(false);
		r.invalidate("course", rect(0, 0, 10, 10));
		expect(r.changedSince(v, "3d", rect(5, 5, 50, 50))).toBe(true);
		expect(r.changedSince(v, "3d", rect(60, 60, 90, 90))).toBe(false); // other area
		expect(r.changedSince(v, "flat", rect(5, 5, 50, 50))).toBe(false); // other view
		expect(r.changedSince(r.version(), "3d", rect(5, 5, 50, 50))).toBe(false); // already painted
	});

	it("invalidate without a rect repaints the decal's bounds; unknown ids do nothing", () => {
		const r = createGroundDecalRegistry();
		r.set("course", decal({ bounds: () => rect(0, 0, 100, 100) }));
		const v = r.version();
		r.invalidate("nope");
		expect(r.version()).toBe(v);
		r.invalidate("course");
		expect(r.changedSince(v, "flat", rect(90, 90, 200, 200))).toBe(true);
		expect(r.changedSince(v, "flat", rect(200, 200, 300, 300))).toBe(false);
	});

	it("replacing repaints both the old and the new bounds and views", () => {
		const r = createGroundDecalRegistry();
		r.set("d", decal({ bounds: () => rect(0, 0, 10, 10), views: ["flat"] }));
		const v = r.version();
		r.set("d", decal({ bounds: () => rect(100, 100, 110, 110), views: ["3d"] }));
		expect(r.changedSince(v, "flat", rect(0, 0, 5, 5))).toBe(true);
		expect(r.changedSince(v, "3d", rect(105, 105, 106, 106))).toBe(true);
		expect(r.changedSince(v, "3d", rect(50, 50, 60, 60))).toBe(true); // the union between
	});

	it("removal repaints where it was; a stale remover doesn't remove a replacement", () => {
		const r = createGroundDecalRegistry();
		const off = r.set("d", decal({ bounds: () => rect(0, 0, 10, 10) }));
		r.set("d", decal({ bounds: () => rect(0, 0, 10, 10), order: 1 }));
		off();
		expect(r.list()).toHaveLength(1);
		const v = r.version();
		r.remove("d");
		expect(r.list()).toHaveLength(0);
		expect(r.changedSince(v, "flat", rect(1, 1, 2, 2))).toBe(true);
	});

	it("changedSince is true once the log no longer reaches back", () => {
		const r = createGroundDecalRegistry();
		r.set("d", decal({ bounds: () => rect(0, 0, 1, 1) }));
		const v = r.version();
		for (let i = 0; i < 300; i++) r.invalidate("d");
		// All of those were far away, but the log forgot what happened right after `v`.
		expect(r.changedSince(v, "flat", rect(500, 500, 600, 600))).toBe(true);
		expect(r.changedSince(r.version() - 1, "flat", rect(500, 500, 600, 600))).toBe(false);
	});

	it("notifies subscribers on every change until unsubscribed", () => {
		const r = createGroundDecalRegistry();
		const listener = vi.fn();
		const off = r.subscribe(listener);
		r.set("d", decal());
		r.invalidate("d");
		r.remove("d");
		expect(listener).toHaveBeenCalledTimes(3);
		off();
		r.set("d", decal());
		expect(listener).toHaveBeenCalledTimes(3);
	});
});

describe("groundDecals", () => {
	it("provides one registry on first use and returns it to every caller", () => {
		const services = fakeServices();
		expect(groundDecalService.get(services)).toBeUndefined();
		const a = groundDecals(services);
		const b = groundDecals(services);
		expect(a).toBe(b);
		expect(groundDecalService.get(services)).toBe(a);
	});
});
