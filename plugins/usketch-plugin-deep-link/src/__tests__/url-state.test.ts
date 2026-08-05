import { describe, expect, it } from "vitest";
import { decodeDeepLink, encodeDeepLink } from "../url-state.js";

describe("decodeDeepLink", () => {
	it("parses a single shape id", () => {
		expect(decodeDeepLink("?shape=abc")).toEqual({ shapeIds: ["abc"], camera: null });
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
		expect(decodeDeepLink("")).toEqual({ shapeIds: [], camera: null });
	});

	it("parses shape and camera together", () => {
		expect(decodeDeepLink("?shape=a,b&x=10&y=20&zoom=2")).toEqual({
			shapeIds: ["a", "b"],
			camera: { x: 10, y: 20, zoom: 2 },
		});
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
		});
	});
});
