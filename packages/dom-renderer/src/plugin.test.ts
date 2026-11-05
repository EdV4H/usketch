import { describe, expect, it } from "vitest";
import { toIdSet, unionHiddenIds } from "./plugin.js";

describe("unionHiddenIds", () => {
	it("is undefined when nothing is hidden", () => {
		expect(unionHiddenIds(new Map())).toBeUndefined();
		expect(unionHiddenIds(new Map([["a", new Set<string>()]]))).toBeUndefined();
	});
	it("hands back a single source's set as-is", () => {
		const ids = new Set(["x"]);
		expect(unionHiddenIds(new Map([["a", ids]]))).toBe(ids);
	});
	it("merges every source", () => {
		const out = unionHiddenIds(
			new Map([
				["a", new Set(["x", "y"])],
				["b", new Set(["y", "z"])],
			]),
		);
		expect([...(out ?? [])].sort()).toEqual(["x", "y", "z"]);
	});
});

describe("toIdSet", () => {
	it("copies any iterable of ids into a Set, dropping non-strings", () => {
		const src = new Set(["a"]);
		const out = toIdSet(src);
		expect(out).not.toBe(src);
		expect([...(out ?? [])]).toEqual(["a"]);
		expect([...(toIdSet(["b", 3, "c"]) ?? [])]).toEqual(["b", "c"]);
		expect(toIdSet(new Map([["k", "v"]]).keys())?.has("k")).toBe(true);
	});
	it("rejects what isn't a collection of ids", () => {
		expect(toIdSet(undefined)).toBeNull();
		expect(toIdSet({ size: 1 })).toBeNull();
		expect(toIdSet("abc")).toBeNull();
	});
});
