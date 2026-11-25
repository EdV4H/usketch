import { describe, expect, it } from "vitest";
import { buildSizeGuides, findSizeSnap, getResizeEdges, resizeKeepingAnchor } from "./size-snap.js";

const corner = { x: "max", y: "max" } as const;

describe("findSizeSnap", () => {
	it("squares a corner drag halfway between width and height", () => {
		const m = findSizeSnap({
			width: 100,
			height: 108,
			edges: corner,
			candidates: [],
			threshold: 12,
		});
		expect(m).toMatchObject({ width: 104, height: 104, square: true });
	});

	it("leaves a box alone once width and height are further apart than the threshold", () => {
		expect(
			findSizeSnap({ width: 100, height: 113, edges: corner, candidates: [], threshold: 12 }),
		).toBeNull();
	});

	it("on an edge handle, only the dragged side takes the other's length", () => {
		const m = findSizeSnap({
			width: 95,
			height: 100,
			edges: { x: "max", y: null },
			candidates: [],
			threshold: 12,
		});
		expect(m).toMatchObject({ width: 100, height: 100, square: true });
	});

	it("keeps an axis alignment fixed and squares the other one to it", () => {
		const m = findSizeSnap({
			width: 100,
			height: 92,
			edges: corner,
			lockX: true,
			candidates: [],
			threshold: 12,
		});
		expect(m).toMatchObject({ width: 100, height: 100, square: true });
	});

	it("does nothing when alignment fixed every moving axis", () => {
		expect(
			findSizeSnap({
				width: 100,
				height: 96,
				edges: corner,
				lockX: true,
				lockY: true,
				candidates: [],
				threshold: 12,
			}),
		).toBeNull();
	});

	it("doesn't square tiny boxes (the first pixels of drawing a shape)", () => {
		expect(
			findSizeSnap({ width: 10, height: 14, edges: corner, candidates: [], threshold: 12 }),
		).toBeNull();
	});

	it("matches another shape's width when that is nearer than a square", () => {
		const m = findSizeSnap({
			width: 150,
			height: 80,
			edges: { x: "max", y: null },
			candidates: [{ id: "a", width: 154, height: 40 }],
			threshold: 12,
		});
		expect(m).toEqual({
			width: 154,
			height: 80,
			square: false,
			sameWidth: ["a"],
			sameHeight: [],
		});
	});

	it("prefers the square on an edge handle when it is the nearer one", () => {
		const m = findSizeSnap({
			width: 98,
			height: 100,
			edges: { x: "max", y: null },
			candidates: [{ id: "a", width: 95, height: 40 }],
			threshold: 12,
		});
		expect(m).toMatchObject({ width: 100, square: true, sameWidth: [] });
	});

	it("matches width and height separately on a corner when no square is near", () => {
		const m = findSizeSnap({
			width: 150,
			height: 80,
			edges: corner,
			candidates: [
				{ id: "a", width: 148, height: 300 },
				{ id: "b", width: 20, height: 84 },
				{ id: "c", width: 148, height: 10 },
			],
			threshold: 12,
		});
		expect(m).toEqual({
			width: 148,
			height: 84,
			square: false,
			sameWidth: ["a", "c"],
			sameHeight: ["b"],
		});
	});

	it("squares the other side up to a matched width", () => {
		const m = findSizeSnap({
			width: 100,
			height: 95,
			edges: corner,
			// A square would move each side by 2.5; matching "a" moves width by just 1.
			candidates: [{ id: "a", width: 101, height: 300 }],
			threshold: 12,
		});
		expect(m).toEqual({
			width: 101,
			height: 101,
			square: true,
			sameWidth: ["a"],
			sameHeight: [],
		});
	});
});

describe("findSizeSnap with square off", () => {
	it("never squares, but still matches sizes", () => {
		expect(
			findSizeSnap({
				width: 100,
				height: 104,
				edges: corner,
				square: false,
				candidates: [],
				threshold: 12,
			}),
		).toBeNull();
		const m = findSizeSnap({
			width: 100,
			height: 95,
			edges: corner,
			square: false,
			candidates: [{ id: "a", width: 101, height: 300 }],
			threshold: 12,
		});
		expect(m).toMatchObject({ width: 101, height: 95, square: false, sameWidth: ["a"] });
	});
});

describe("getResizeEdges", () => {
	const box = { x: 0, y: 0, width: 100, height: 50 };

	it("reads the moving edges of an unrotated resize", () => {
		expect(getResizeEdges(box, { x: 0, y: 0, width: 120, height: 50 })).toEqual({
			x: "max",
			y: null,
		});
		expect(getResizeEdges(box, { x: -10, y: -5, width: 110, height: 55 })).toEqual({
			x: "min",
			y: "min",
		});
	});

	it("reads them along a rotated shape's own axes", () => {
		// Turned 90°: the local width runs down the board. Growing the width with
		// the local left edge fixed moves the center down by half the growth.
		const after = { x: -10, y: 10, width: 120, height: 50 };
		expect(getResizeEdges(box, after, 90)).toEqual({ x: "max", y: null });
	});
});

describe("resizeKeepingAnchor", () => {
	it("keeps the edges the resize doesn't move", () => {
		const box = { x: 10, y: 20, width: 100, height: 108 };
		expect(resizeKeepingAnchor(box, { x: "max", y: "max" }, 104, 104)).toEqual({
			x: 10,
			y: 20,
			width: 104,
			height: 104,
		});
		expect(resizeKeepingAnchor(box, { x: "min", y: "min" }, 104, 104)).toEqual({
			x: 6,
			y: 24,
			width: 104,
			height: 104,
		});
	});

	it("keeps the anchored side of a rotated shape where it is on the board", () => {
		// Turned 90°, local width runs along +y: the local left edge is the top.
		const box = { x: 0, y: 0, width: 100, height: 50 };
		const next = resizeKeepingAnchor(box, { x: "max", y: null }, 120, 50, 90);
		// The center moves down 10 (half the growth along local x = board +y).
		expect(next.x + next.width / 2).toBeCloseTo(50);
		expect(next.y + next.height / 2).toBeCloseTo(35);
		expect(next.width).toBe(120);
	});
});

describe("buildSizeGuides", () => {
	const box = { x: 0, y: 0, width: 100, height: 100 };
	const match = { width: 100, height: 100, square: true, sameWidth: [], sameHeight: [] };

	it("draws the diagonal through the dragged corner", () => {
		expect(buildSizeGuides(box, { x: "max", y: "max" }, match, new Map())).toEqual([
			{ kind: "square", from: { x: 0, y: 0 }, to: { x: 100, y: 100 } },
		]);
		expect(buildSizeGuides(box, { x: "max", y: "min" }, match, new Map())).toEqual([
			{ kind: "square", from: { x: 100, y: 0 }, to: { x: 0, y: 100 } },
		]);
	});

	it("draws a width bar on the resized shape and each shape it matches", () => {
		const guides = buildSizeGuides(
			box,
			{ x: "max", y: null },
			{ ...match, square: false, sameWidth: ["a"] },
			new Map([["a", { x: 300, y: 40, width: 100, height: 20 }]]),
		);
		expect(guides).toEqual([
			{
				kind: "dimension",
				axis: "x",
				segments: [
					{ start: 0, end: 100, cross: 0 },
					{ start: 300, end: 400, cross: 40 },
				],
			},
		]);
	});
});
