import { describe, expect, it } from "vitest";
import { layoutDiagram } from "../layout.js";

const frame = { x: 100, y: 200, width: 520, height: 380 };
const pts = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `p${i}` }));

describe("layoutDiagram", () => {
	it("returns empty for no points", () => {
		expect(layoutDiagram([], [], frame)).toEqual({ boxes: [], edges: [] });
	});

	it("keeps all boxes within the frame bounds", () => {
		const { boxes } = layoutDiagram(pts(6), [], frame);
		expect(boxes).toHaveLength(6);
		for (const b of boxes) {
			expect(b.x).toBeGreaterThanOrEqual(frame.x);
			expect(b.y).toBeGreaterThanOrEqual(frame.y);
			expect(b.x + b.w).toBeLessThanOrEqual(frame.x + frame.width);
			expect(b.y + b.h).toBeLessThanOrEqual(frame.y + frame.height);
		}
	});

	it("does not overlap boxes (grid cells are disjoint)", () => {
		const { boxes } = layoutDiagram(pts(4), [], frame);
		for (let i = 0; i < boxes.length; i++) {
			for (let j = i + 1; j < boxes.length; j++) {
				const a = boxes[i];
				const b = boxes[j];
				const disjoint =
					a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
				expect(disjoint).toBe(true);
			}
		}
	});

	it("validates + dedupes edges against the box count", () => {
		const { edges } = layoutDiagram(
			pts(3),
			[
				[0, 1],
				[0, 1],
				[1, 1],
				[2, 9],
			],
			frame,
		);
		expect(edges).toEqual([{ from: 0, to: 1 }]);
	});

	it("carries label/detail onto boxes", () => {
		const { boxes } = layoutDiagram([{ label: "L", detail: "D" }], [], frame);
		expect(boxes[0].label).toBe("L");
		expect(boxes[0].detail).toBe("D");
	});
});
