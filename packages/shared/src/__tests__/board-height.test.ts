import { describe, expect, it, vi } from "vitest";
import { boardHeight, boardHeightService, createBoardHeight } from "../board-height.js";
import { groundHeightService } from "../ground-height.js";
import { solidHeightService } from "../solid-height.js";
import type { ServiceRegistry } from "../types/plugin.js";

/** The core's service registry, as a plain map (a later provide wins; unprovide only its own). */
function services(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, value) {
			map.set(key, value);
			return () => {
				if (map.get(key) === value) map.delete(key);
			};
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

describe("board height", () => {
	it("is flat with no provider", () => {
		const h = createBoardHeight();
		expect(h.groundAt(1, 2)).toBe(0);
		expect(h.solidAt(1, 2)).toBeNull();
		expect(h.surfaceAt(1, 2)).toBe(0);
		expect(h.owner()).toBeNull();
	});

	it("answers the ground from the highest-priority active provider", () => {
		const h = createBoardHeight();
		let field = false;
		h.register({ id: "map", kind: "ground", heightAt: () => 10 });
		h.register({
			id: "elevation",
			kind: "ground",
			priority: 10,
			active: () => field,
			heightAt: (x) => x,
		});
		expect(h.groundAt(5, 0)).toBe(10);
		expect(h.owner()).toBe("map");
		field = true;
		expect(h.groundAt(5, 0)).toBe(5);
		expect(h.owner()).toBe("elevation");
	});

	it("passes a ground's null to the next provider, and lets the later one win a tie", () => {
		const h = createBoardHeight();
		h.register({ id: "a", kind: "ground", heightAt: () => 1 });
		h.register({ id: "b", kind: "ground", heightAt: (x) => (x > 0 ? 2 : null) });
		expect(h.groundAt(1, 0)).toBe(2);
		expect(h.groundAt(-1, 0)).toBe(1);
	});

	it("takes the highest solid and stands on finite tops only", () => {
		const h = createBoardHeight();
		h.register({ id: "ground", kind: "ground", heightAt: () => 4 });
		h.register({ id: "blocks", kind: "solid", heightAt: (x) => (x > 0 ? 20 : null) });
		h.register({ id: "walls", kind: "solid", heightAt: (x) => (x > 10 ? Infinity : null) });
		expect(h.solidAt(-1, 0)).toBeNull();
		expect(h.solidAt(1, 0)).toBe(20);
		expect(h.solidAt(11, 0)).toBe(Infinity);
		expect(h.surfaceAt(-1, 0)).toBe(4);
		expect(h.surfaceAt(1, 0)).toBe(20);
		expect(h.surfaceAt(11, 0)).toBe(4);
	});

	it("removes a provider and tells subscribers", () => {
		const h = createBoardHeight();
		const listener = vi.fn();
		h.subscribe(listener);
		const off = h.register({ id: "map", kind: "ground", heightAt: () => 3 });
		expect(listener).toHaveBeenCalledTimes(1);
		off();
		off();
		expect(listener).toHaveBeenCalledTimes(2);
		expect(h.groundAt(0, 0)).toBe(0);
		h.notify();
		expect(listener).toHaveBeenCalledTimes(3);
	});

	it("replaces a provider registered again under the same id", () => {
		const h = createBoardHeight();
		h.register({ id: "map", kind: "ground", heightAt: () => 3 });
		h.register({ id: "map", kind: "ground", heightAt: () => 7 });
		expect(h.groundAt(0, 0)).toBe(7);
	});

	it("is one per board, provided on first use", () => {
		const s = services();
		const h = boardHeight(s);
		expect(boardHeight(s)).toBe(h);
		expect(boardHeightService.get(s)).toBe(h);
	});
});

describe("board height with the older services", () => {
	it("answers older readers through the services", () => {
		const s = services();
		const h = boardHeight(s);
		h.register({ id: "map", kind: "ground", heightAt: () => 6 });
		h.register({ id: "blocks", kind: "solid", heightAt: () => 30 });
		expect(groundHeightService.get(s)?.heightAt(0, 0)).toBe(6);
		expect(solidHeightService.get(s)?.heightAt(0, 0)).toBe(30);
	});

	it("reads an older provider set up before it as the lowest ground and one more solid", () => {
		const s = services();
		groundHeightService.provide(s, { heightAt: () => 2 });
		solidHeightService.provide(s, { heightAt: () => 9 });
		const h = boardHeight(s);
		expect(h.groundAt(0, 0)).toBe(2);
		expect(h.solidAt(0, 0)).toBe(9);
		let field = false;
		h.register({
			id: "elevation",
			kind: "ground",
			priority: 10,
			active: () => field,
			heightAt: () => 50,
		});
		h.register({ id: "blocks", kind: "solid", heightAt: () => 12 });
		expect(h.groundAt(0, 0)).toBe(2);
		expect(h.solidAt(0, 0)).toBe(12);
		field = true;
		expect(h.groundAt(0, 0)).toBe(50);
	});

	it("ranks an older provider set up after it below raised priorities and above the default", () => {
		const s = services();
		const h = boardHeight(s);
		h.register({ id: "map", kind: "ground", heightAt: () => 1 });
		groundHeightService.provide(s, { heightAt: () => 4 });
		expect(h.groundAt(0, 0)).toBe(4);
		expect(h.owner()).toBeNull();
		h.register({ id: "elevation", kind: "ground", priority: 10, heightAt: () => 8 });
		expect(h.groundAt(0, 0)).toBe(8);
		expect(h.owner()).toBe("elevation");
	});

	it("doesn't loop when an older provider falls back to the service it replaced", () => {
		const s = services();
		const h = boardHeight(s);
		h.register({ id: "map", kind: "ground", heightAt: () => 3 });
		// The older elevation: wraps whatever was provided before it (here, the adapter).
		const previous = groundHeightService.get(s);
		let field = false;
		groundHeightService.provide(s, {
			heightAt: (x, y) => (field ? 40 : (previous?.heightAt(x, y) ?? 0)),
		});
		expect(h.groundAt(0, 0)).toBe(3);
		field = true;
		expect(h.groundAt(0, 0)).toBe(40);
		// The older reader sees the same.
		expect(groundHeightService.get(s)?.heightAt(0, 0)).toBe(40);
	});

	it("adds an older solid provider set up after it", () => {
		const s = services();
		const h = boardHeight(s);
		h.register({ id: "blocks", kind: "solid", heightAt: () => 5 });
		solidHeightService.provide(s, { heightAt: () => Infinity });
		expect(h.solidAt(0, 0)).toBe(Infinity);
	});
});
