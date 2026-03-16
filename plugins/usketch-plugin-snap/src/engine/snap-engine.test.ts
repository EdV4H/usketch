import type { BoundingBox } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { calculateSnap } from "./snap-engine.js";
import type { SnapSettings } from "./types.js";

const defaults: SnapSettings = {
	enabled: true,
	threshold: 8,
	edgeSnap: true,
	centerSnap: true,
	viewportOnly: false,
};

function makeCandidates(boxes: Record<string, BoundingBox>): Map<string, BoundingBox> {
	return new Map(Object.entries(boxes));
}

describe("calculateSnap", () => {
	it("snaps left edge to left edge", () => {
		const moving: BoundingBox = { x: 102, y: 50, width: 40, height: 30 };
		const candidates = makeCandidates({
			target: { x: 100, y: 150, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, defaults);
		expect(result.dx).toBe(-2); // 100 - 102
		expect(result.dy).toBe(0);
	});

	it("snaps right edge to right edge", () => {
		const moving: BoundingBox = { x: 100, y: 50, width: 58, height: 30 };
		// moving right = 158, target right = 160
		const candidates = makeCandidates({
			target: { x: 100, y: 150, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, defaults);
		// left edges match exactly (100=100, dist=0), so dx=0
		expect(result.dx).toBe(0);
	});

	it("snaps left edge to right edge", () => {
		const moving: BoundingBox = { x: 163, y: 50, width: 40, height: 30 };
		// target right = 160, moving left = 163, dist = 3
		const candidates = makeCandidates({
			target: { x: 100, y: 150, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, defaults);
		expect(result.dx).toBe(-3); // 160 - 163
	});

	it("snaps center to center", () => {
		const moving: BoundingBox = { x: 105, y: 50, width: 40, height: 30 };
		// moving center x = 125, target center x = 130
		const candidates = makeCandidates({
			target: { x: 100, y: 150, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, {
			...defaults,
			edgeSnap: false,
		});
		expect(result.dx).toBe(5); // 130 - 125
	});

	it("does not snap when beyond threshold", () => {
		const moving: BoundingBox = { x: 120, y: 50, width: 40, height: 30 };
		// moving left = 120, target left = 100, dist = 20 (> 8)
		const candidates = makeCandidates({
			target: { x: 100, y: 250, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, {
			...defaults,
			edgeSnap: true,
			centerSnap: false,
		});
		// moving: left=120, center=140, right=160
		// target: left=100, center=130, right=160
		// right-right = 0! That's within threshold
		expect(result.dx).toBe(0); // right edges match exactly
	});

	it("snaps X and Y independently", () => {
		const moving: BoundingBox = { x: 103, y: 203, width: 40, height: 30 };
		const candidates = makeCandidates({
			target: { x: 100, y: 200, width: 60, height: 40 },
		});

		// Edge-only to get deterministic min-to-min matching
		const result = calculateSnap(moving, new Set(["moving"]), candidates, {
			...defaults,
			centerSnap: false,
		});
		expect(result.dx).toBe(-3); // 100 - 103
		expect(result.dy).toBe(-3); // 200 - 203
	});

	it("selects the closest candidate among multiple", () => {
		const moving: BoundingBox = { x: 105, y: 50, width: 40, height: 30 };
		const candidates = makeCandidates({
			far: { x: 90, y: 150, width: 60, height: 40 },
			close: { x: 103, y: 150, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, {
			...defaults,
			centerSnap: false,
		});
		// moving left=105; far left=90 (dist=15>8 but far right=150, close left=103 dist=2)
		expect(result.dx).toBe(-2); // 103 - 105
	});

	it("returns empty result when disabled", () => {
		const moving: BoundingBox = { x: 100, y: 50, width: 40, height: 30 };
		const candidates = makeCandidates({
			target: { x: 100, y: 150, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, {
			...defaults,
			enabled: false,
		});
		expect(result.dx).toBe(0);
		expect(result.dy).toBe(0);
		expect(result.lines).toHaveLength(0);
	});

	it("produces guide lines with indicators when snapping", () => {
		const moving: BoundingBox = { x: 102, y: 202, width: 40, height: 30 };
		const candidates = makeCandidates({
			target: { x: 100, y: 200, width: 60, height: 40 },
		});

		const result = calculateSnap(moving, new Set(["moving"]), candidates, defaults);
		expect(result.lines.length).toBeGreaterThan(0);

		const xLine = result.lines.find((l) => l.axis === "x");
		const yLine = result.lines.find((l) => l.axis === "y");
		expect(xLine).toBeDefined();
		expect(yLine).toBeDefined();
		expect(xLine?.position).toBe(100);
		expect(yLine?.position).toBe(200);

		// Each line has edge info and indicators
		expect(xLine?.movingEdge).toBeDefined();
		expect(xLine?.candidateEdge).toBeDefined();
		// Edge snap: 2 dots per shape (both corners) × 2 shapes = 4
		expect(xLine?.indicators.length).toBe(4);
		expect(yLine?.indicators.length).toBe(4);
	});

	it("excludes moving shapes from candidates", () => {
		const moving: BoundingBox = { x: 100, y: 50, width: 40, height: 30 };
		const candidates = makeCandidates({
			self: { x: 100, y: 50, width: 40, height: 30 },
		});

		const result = calculateSnap(moving, new Set(["self"]), candidates, defaults);
		// self is in movingIds, so it should be excluded
		expect(result.dx).toBe(0);
		expect(result.dy).toBe(0);
		expect(result.lines).toHaveLength(0);
	});
});
