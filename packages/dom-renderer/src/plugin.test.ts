import { describe, expect, it } from "vitest";
import { unionHiddenIds } from "./plugin.js";

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
