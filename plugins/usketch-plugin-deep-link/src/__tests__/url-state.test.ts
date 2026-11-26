import { describe, expect, it } from "vitest";
import { decodeDeepLink, encodeDeepLink } from "../url-state.js";

describe("decodeDeepLink", () => {
	it("parses a single shape id", () => {
		expect(decodeDeepLink("?shape=abc")).toEqual({
			shapeIds: ["abc"],
			camera: null,
			view: null,
		});
	});

	it("parses multiple comma-separated shape ids", () => {
		expect(decodeDeepLink("?shape=abc,def,ghi").shapeIds).toEqual(["abc", "def", "ghi"]);
	});

	it("trims blanks and drops empty entries", () => {
		expect(decodeDeepLink("?shape=abc,,%20def%20").shapeIds).toEqual(["abc", "def"]);
	});

	it("parses a camera when x/y/zoom are all present", () => {
		expect(decodeDeepLink("?x=100&y=-50&zoom=1.5").camera).toEqual({ x: 100, y: -50, zoom: 1.5 });
	});

	it("ignores a partial camera", () => {
		expect(decodeDeepLink("?x=100&y=-50").camera).toBeNull();
	});

	it("rejects a non-positive or non-finite zoom", () => {
		expect(decodeDeepLink("?x=0&y=0&zoom=0").camera).toBeNull();
		expect(decodeDeepLink("?x=0&y=0&zoom=abc").camera).toBeNull();
	});

	it("returns empty state for an empty query", () => {
		expect(decodeDeepLink("")).toEqual({ shapeIds: [], camera: null, view: null });
	});

	it("parses shape and camera together", () => {
		expect(decodeDeepLink("?shape=a,b&x=10&y=20&zoom=2")).toEqual({
			shapeIds: ["a", "b"],
			camera: { x: 10, y: 20, zoom: 2 },
			view: null,
		});
	});

	it("parses a centre-anchored view from cx/cy/zoom", () => {
		expect(decodeDeepLink("?cx=500&cy=-250&zoom=0.5")).toEqual({
			shapeIds: [],
			camera: null,
			view: { x: 500, y: -250, zoom: 0.5 },
		});
	});

	it("ignores a partial or invalid view", () => {
		expect(decodeDeepLink("?cx=500&zoom=1").view).toBeNull();
		expect(decodeDeepLink("?cx=1&cy=2&zoom=-1").view).toBeNull();
	});
});

describe("encodeDeepLink", () => {
	it("sets a readable (unescaped) comma-separated shape list", () => {
		expect(encodeDeepLink("", { shapeIds: ["a", "b"] })).toBe("?shape=a,b");
	});

	it("removes the shape param when the selection is empty", () => {
		expect(encodeDeepLink("?shape=a,b", { shapeIds: [] })).toBe("");
	});

	it("rounds the camera (x/y integer, zoom 3dp)", () => {
		expect(encodeDeepLink("", { camera: { x: 10.7, y: -3.2, zoom: 1.23456 } })).toBe(
			"?x=11&y=-3&zoom=1.235",
		);
	});

	it("removes camera params when camera is null", () => {
		expect(encodeDeepLink("?x=1&y=2&zoom=3", { camera: null })).toBe("");
	});

	it("preserves unrelated params", () => {
		const out = encodeDeepLink("?t=token", { shapeIds: ["a"] });
		expect(out).toContain("t=token");
		expect(out).toContain("shape=a");
	});

	it("does not un-escape encoded commas in unrelated params (only the shape list)", () => {
		const out = encodeDeepLink("?t=a%2Cb", { shapeIds: ["x", "y"] });
		// The `shape` list stays readable, but `t`'s encoded comma is untouched.
		expect(out).toContain("t=a%2Cb");
		expect(out).toContain("shape=x,y");
	});

	it("only touches provided fields", () => {
		// camera not provided → existing camera params stay
		expect(encodeDeepLink("?x=1&y=2&zoom=3", { shapeIds: ["a"] })).toBe("?x=1&y=2&zoom=3&shape=a");
	});

	it("round-trips shape + camera through decode", () => {
		const search = encodeDeepLink("", {
			shapeIds: ["a", "b"],
			camera: { x: 100, y: 200, zoom: 1.5 },
		});
		expect(decodeDeepLink(search)).toEqual({
			shapeIds: ["a", "b"],
			camera: { x: 100, y: 200, zoom: 1.5 },
			view: null,
		});
	});

	it("writes a centre-anchored view (cx/cy integer, zoom 3dp)", () => {
		expect(encodeDeepLink("?page=p1", { view: { x: 10.7, y: -3.2, zoom: 1.23456 } })).toBe(
			"?page=p1&cx=10.7&cy=-3.2&zoom=1.235",
		);
	});

	it("removes view params when view is null", () => {
		expect(encodeDeepLink("?cx=1&cy=2&zoom=3&page=p1", { view: null })).toBe("?page=p1");
	});

	it("keeps the shared zoom while the other anchor remains", () => {
		expect(encodeDeepLink("?x=1&y=2&cx=3&cy=4&zoom=2", { view: null })).toBe("?x=1&y=2&zoom=2");
		expect(encodeDeepLink("?x=1&y=2&cx=3&cy=4&zoom=2", { camera: null })).toBe("?cx=3&cy=4&zoom=2");
	});

	it("drops a stale exact camera when only a view is set", () => {
		const search = encodeDeepLink("?x=1&y=2&zoom=3", { view: { x: 5, y: 6, zoom: 0.5 } });
		expect(decodeDeepLink(search)).toEqual({
			shapeIds: [],
			camera: null,
			view: { x: 5, y: 6, zoom: 0.5 },
		});
	});

	it("replaces an exact camera with a view", () => {
		expect(
			encodeDeepLink("?shape=a&x=1&y=2&zoom=3", {
				shapeIds: [],
				camera: null,
				view: { x: 5, y: 6, zoom: 2 },
			}),
		).toBe("?zoom=2&cx=5&cy=6");
	});
});
