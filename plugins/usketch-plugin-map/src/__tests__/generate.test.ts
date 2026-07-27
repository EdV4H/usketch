import { describe, expect, it } from "vitest";
import { clampBox } from "../generate.js";

function dims(box: { minC: number; minR: number; maxC: number; maxR: number }) {
	return [box.maxC - box.minC + 1, box.maxR - box.minR + 1];
}

describe("clampBox", () => {
	it("leaves small boxes unchanged", () => {
		const b = { minC: 0, minR: 0, maxC: 9, maxR: 7 };
		expect(clampBox(b)).toEqual(b);
	});

	it("caps an oversized box to exactly 256×256 cells (inclusive bounds)", () => {
		const b = { minC: -1000, minR: -1000, maxC: 1000, maxR: 1000 };
		const [w, h] = dims(clampBox(b));
		expect(w).toBe(256);
		expect(h).toBe(256);
	});

	it("clamps only the oversized dimension", () => {
		const b = { minC: 0, minR: 0, maxC: 999, maxR: 5 };
		const c = clampBox(b);
		expect(c.maxC - c.minC + 1).toBe(256);
		expect(c.minR).toBe(0);
		expect(c.maxR).toBe(5);
	});
});
