import type { BoundingBox } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { calculateSnap } from "./snap-engine.js";
import type { SnapSettings } from "./types.js";

/** Settings that isolate distribution snapping (edge/center off unless a test wants them). */
function settings(over: Partial<SnapSettings> = {}): SnapSettings {
	return {
		enabled: true,
		threshold: 8,
		edgeSnap: false,
		centerSnap: false,
		distributeSnap: true,
		viewportOnly: false,
		altBehavior: "suppress",
		guideStyle: { color: "#000", dash: "4 3", strokeWidth: 1, indicatorRadius: 3, diamondSize: 4 },
		...over,
	};
}

function candidates(boxes: Record<string, BoundingBox>): Map<string, BoundingBox> {
	return new Map(Object.entries(boxes));
}

const box = (x: number, y: number, width: number, height: number): BoundingBox => ({
	x,
	y,
	width,
	height,
});
const NO_MOVING = new Set<string>();

describe("distribution snap — gap duplication", () => {
	// A[0..10] and B[30..40] on the same row → an existing gap of 20 (10→30).
	const row = candidates({ a: box(0, 0, 10, 10), b: box(30, 0, 10, 10) });

	it("snaps a third box to the RIGHT to replicate the gap (3-in-a-row)", () => {
		// Target: M.min = B.max(40) + 20 = 60. Drag M to x=58 (2px short).
		const r = calculateSnap(box(58, 0, 10, 10), NO_MOVING, row, settings());
		expect(r.dx).toBe(2); // 60 - 58
		expect(r.dy).toBe(0);
		expect(r.gaps).toHaveLength(1);
		expect(r.gaps[0].axis).toBe("x");
		expect(r.gaps[0].length).toBe(20);
		// highlights the existing A–B gap plus the new B–M gap
		expect(r.gaps[0].segments.length).toBe(2);
		expect(r.lines).toHaveLength(0);
	});

	it("snaps a box to the LEFT to replicate the gap", () => {
		// Target: M.max = A.min(0) - 20 = -20 → M.min = -30. Drag M to x=-28 (max=-18).
		const r = calculateSnap(box(-28, 0, 10, 10), NO_MOVING, row, settings());
		expect(r.dx).toBe(-2); // target max -20, current max -18
		expect(r.gaps[0].length).toBe(20);
	});

	it("does not snap when the box is beyond the threshold", () => {
		// Target 60, drag to x=50 (10 off) with threshold 8 → no distribute.
		const r = calculateSnap(box(50, 0, 10, 10), NO_MOVING, row, settings());
		expect(r.dx).toBe(0);
		expect(r.gaps).toHaveLength(0);
	});

	it("highlights ALL equal gaps (A–B and B–C) plus the new one", () => {
		// A[0..10], B[30..40], C[60..70] → two equal 20 gaps. Dup right of C: target 90.
		const three = candidates({
			a: box(0, 0, 10, 10),
			b: box(30, 0, 10, 10),
			c: box(60, 0, 10, 10),
		});
		const r = calculateSnap(box(88, 0, 10, 10), NO_MOVING, three, settings());
		expect(r.dx).toBe(2); // 90 - 88
		expect(r.gaps[0].length).toBe(20);
		expect(r.gaps[0].segments.length).toBe(3); // A–B, B–C, new C–M
	});
});

describe("distribution snap — center in gap", () => {
	// A[0..10], B[100..110] → gap of 90. M width 30 fits.
	const row = candidates({ a: box(0, 0, 10, 10), b: box(100, 0, 10, 10) });

	it("centers the box in the gap (equal spacing both sides)", () => {
		// Gap center = (10 + 100)/2 = 55; M center target 55 → M.min = 40.
		// Drag M to x=42 (center 57) → delta -2.
		const r = calculateSnap(box(42, 0, 30, 10), NO_MOVING, row, settings());
		expect(r.dx).toBe(-2);
		expect(r.gaps).toHaveLength(1);
		expect(r.gaps[0].length).toBe(30); // (90 - 30) / 2 each side
		expect(r.gaps[0].segments.length).toBe(2);
	});

	it("does not center when the box is larger than the gap", () => {
		const r = calculateSnap(box(42, 0, 200, 10), NO_MOVING, row, settings());
		expect(r.gaps).toHaveLength(0);
	});
});

describe("distribution snap — row (breadth) filtering", () => {
	it("ignores candidates whose cross-axis extent does not overlap the moving box", () => {
		// A and B are far away on Y (y=500) → not in M's row → no gap to duplicate.
		const offRow = candidates({ a: box(0, 500, 10, 10), b: box(30, 500, 10, 10) });
		const r = calculateSnap(box(58, 0, 10, 10), NO_MOVING, offRow, settings());
		expect(r.dx).toBe(0);
		expect(r.gaps).toHaveLength(0);
	});

	it("works on the Y axis for a vertical column", () => {
		// A[y 0..10], B[y 30..40] in the same column (x overlaps). Dup below B: y target 60.
		const col = candidates({ a: box(0, 0, 10, 10), b: box(0, 30, 10, 10) });
		const r = calculateSnap(box(0, 58, 10, 10), NO_MOVING, col, settings());
		expect(r.dy).toBe(2);
		expect(r.dx).toBe(0);
		expect(r.gaps[0].axis).toBe("y");
		expect(r.gaps[0].length).toBe(20);
	});
});

describe("distribution vs alignment", () => {
	it("prefers alignment when it is the nearer snap on that axis", () => {
		// Row A[0..10], B[30..40] (gap 20). Also a shape D whose left edge is at 59,
		// so an edge-align to x=59 is 1px away while distribute target 60 is 2px away.
		const row = candidates({
			a: box(0, 0, 10, 10),
			b: box(30, 0, 10, 10),
			d: box(59, 0, 10, 10),
		});
		const r = calculateSnap(box(58, 0, 10, 10), NO_MOVING, row, settings({ edgeSnap: true }));
		expect(r.dx).toBe(1); // aligns min→59, not distribute→60
		expect(r.gaps).toHaveLength(0); // distribution did not win
		expect(r.lines.some((l) => l.axis === "x")).toBe(true); // an x alignment line instead
	});

	it("prefers distribution when it is the nearer snap", () => {
		const row = candidates({
			a: box(0, 0, 10, 10),
			b: box(30, 0, 10, 10),
			d: box(64, 0, 10, 10), // edge-align to 64 is 3px away; distribute 60 is 1px
		});
		const r = calculateSnap(box(59, 0, 10, 10), NO_MOVING, row, settings({ edgeSnap: true }));
		expect(r.dx).toBe(1); // distribute → 60
		expect(r.gaps).toHaveLength(1);
	});
});

describe("distribution snap — gating", () => {
	const row = candidates({ a: box(0, 0, 10, 10), b: box(30, 0, 10, 10) });

	it("does nothing when distributeSnap is off", () => {
		const r = calculateSnap(
			box(58, 0, 10, 10),
			NO_MOVING,
			row,
			settings({ distributeSnap: false }),
		);
		expect(r.dx).toBe(0);
		expect(r.gaps).toHaveLength(0);
	});

	it("is skipped during resize (edgeFilter present)", () => {
		const r = calculateSnap(box(58, 0, 10, 10), NO_MOVING, row, settings(), undefined, {
			xEdges: ["max"],
		});
		expect(r.gaps).toHaveLength(0);
	});
});
