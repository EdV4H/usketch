import { describe, expect, it, vi } from "vitest";
import { createShapeClaims, shapeClaims, shapeClaimsService } from "../shape-claims.js";
import type { ServiceRegistry } from "../types/plugin.js";

function services(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, value) {
			map.set(key, value);
			return () => map.delete(key);
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

describe("shape claims", () => {
	it("unions every source's ids and lets each replace or release its own", () => {
		const c = createShapeClaims();
		expect(c.claimed()).toBeUndefined();
		c.claim("a", new Set(["1", "2"]));
		c.claim("b", ["3"]);
		expect([...(c.claimed() ?? [])].sort()).toEqual(["1", "2", "3"]);
		c.claim("a", ["2"]);
		expect([...(c.claimed() ?? [])].sort()).toEqual(["2", "3"]);
		c.claim("b", []);
		expect([...(c.claimed() ?? [])]).toEqual(["2"]);
		c.claim("a", new Set());
		expect(c.claimed()).toBeUndefined();
	});

	it("notifies only when a source's set changes", () => {
		const c = createShapeClaims();
		const listener = vi.fn();
		const off = c.subscribe(listener);
		c.claim("a", ["1"]);
		c.claim("a", new Set(["1"]));
		expect(listener).toHaveBeenCalledTimes(1);
		c.claim("a", []);
		c.claim("a", []);
		expect(listener).toHaveBeenCalledTimes(2);
		off();
		c.claim("a", ["2"]);
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("is one per board, provided on first use", () => {
		const s = services();
		const c = shapeClaims(s);
		expect(shapeClaims(s)).toBe(c);
		expect(shapeClaimsService.get(s)).toBe(c);
	});
});
