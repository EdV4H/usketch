import type { BoardStore, BoundingBox, ShapeData, Viewport } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { applyStartPosition, captureViewport } from "../resolve.js";

interface Recorded {
	animateViewportTo: { vp: Viewport }[];
	fitToBounds: { bounds: BoundingBox; padding?: number }[];
}

function fakeStore(opts: { viewport?: Viewport; shapes?: Record<string, ShapeData> } = {}): {
	store: BoardStore;
	rec: Recorded;
} {
	const rec: Recorded = { animateViewportTo: [], fitToBounds: [] };
	const shapes = opts.shapes ?? {};
	const store = {
		getViewport: () => opts.viewport ?? { x: 0, y: 0, zoom: 1 },
		getShape: (id: string) => shapes[id],
		animateViewportTo: (vp: Viewport) => rec.animateViewportTo.push({ vp }),
		fitToBounds: (bounds: BoundingBox, _size: unknown, padding?: number) =>
			rec.fitToBounds.push({ bounds, padding }),
	} as unknown as BoardStore;
	return { store, rec };
}

describe("applyStartPosition", () => {
	it("coordinate: recenters keeping the current zoom", () => {
		const { store, rec } = fakeStore({ viewport: { x: 0, y: 0, zoom: 3 } });
		expect(applyStartPosition(store, { kind: "coordinate", x: 100, y: 50 })).toBe(true);
		expect(rec.animateViewportTo).toHaveLength(1);
		expect(rec.animateViewportTo[0].vp.zoom).toBe(3); // kept current zoom
	});

	it("viewport: uses the pinned zoom", () => {
		const { store, rec } = fakeStore({ viewport: { x: 0, y: 0, zoom: 3 } });
		expect(applyStartPosition(store, { kind: "viewport", x: 0, y: 0, zoom: 0.5 })).toBe(true);
		expect(rec.animateViewportTo[0].vp.zoom).toBe(0.5);
	});

	it("shape: frames the referenced shape's bounds", () => {
		const shape = {
			id: "s1",
			type: "rect",
			x: 10,
			y: 20,
			width: 40,
			height: 30,
			rotation: 0,
		} as unknown as ShapeData;
		const { store, rec } = fakeStore({ shapes: { s1: shape } });
		expect(applyStartPosition(store, { kind: "shape", shapeId: "s1", padding: 25 })).toBe(true);
		expect(rec.fitToBounds).toHaveLength(1);
		expect(rec.fitToBounds[0].bounds).toMatchObject({ x: 10, y: 20, width: 40, height: 30 });
		expect(rec.fitToBounds[0].padding).toBe(25);
	});

	it("shape: returns false (no camera move) when the shape is gone", () => {
		const { store, rec } = fakeStore();
		expect(applyStartPosition(store, { kind: "shape", shapeId: "missing" })).toBe(false);
		expect(rec.fitToBounds).toHaveLength(0);
		expect(rec.animateViewportTo).toHaveLength(0);
	});

	it("shape: returns false for an unframeable (zero-size) shape", () => {
		const zero = {
			id: "z",
			type: "rect",
			x: 5,
			y: 5,
			width: 0,
			height: 0,
			rotation: 0,
		} as unknown as ShapeData;
		const { store, rec } = fakeStore({ shapes: { z: zero } });
		expect(applyStartPosition(store, { kind: "shape", shapeId: "z" })).toBe(false);
		expect(rec.fitToBounds).toHaveLength(0);
	});

	it("clamps an out-of-range viewport zoom into [0.1, 10]", () => {
		const { store, rec } = fakeStore();
		expect(applyStartPosition(store, { kind: "viewport", x: 0, y: 0, zoom: 500 })).toBe(true);
		expect(rec.animateViewportTo[0].vp.zoom).toBe(10);
	});

	it("rejects malformed coordinates from corrupt synced data (no camera move)", () => {
		const { store, rec } = fakeStore();
		// biome-ignore lint/suspicious/noExplicitAny: intentionally malformed data
		const bad: any[] = [
			{ kind: "coordinate", x: Number.NaN, y: 0 },
			{ kind: "coordinate", x: 0, y: Number.POSITIVE_INFINITY },
			{ kind: "viewport", x: 0, y: 0, zoom: Number.NaN },
			{ kind: "viewport", x: 0, y: 0, zoom: 0 },
			{ kind: "viewport", x: Number.NaN, y: 0, zoom: 1 },
		];
		for (const b of bad) expect(applyStartPosition(store, b)).toBe(false);
		expect(rec.animateViewportTo).toHaveLength(0);
	});
});

describe("captureViewport", () => {
	it("returns the world center point and current zoom (screen-size independent)", () => {
		const { store } = fakeStore({ viewport: { x: 0, y: 0, zoom: 2 } });
		const cap = captureViewport(store);
		expect(cap.zoom).toBe(2);
		expect(Number.isFinite(cap.x)).toBe(true);
		expect(Number.isFinite(cap.y)).toBe(true);
	});
});
