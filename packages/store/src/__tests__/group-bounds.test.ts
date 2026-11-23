import type { ShapeData } from "@edv4h/usketch-shared";
import { getShapeCorners } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { computeGroupBounds } from "../hierarchy-utils.js";

function rect(x: number, y: number, width: number, height: number, rotation?: number): ShapeData {
	return { id: `${x},${y}`, type: "rect", x, y, width, height, rotation } as ShapeData;
}

describe("computeGroupBounds", () => {
	it("encloses unrotated children", () => {
		expect(computeGroupBounds([rect(0, 0, 100, 50), rect(200, 100, 50, 50)])).toEqual({
			x: 0,
			y: 0,
			width: 250,
			height: 150,
		});
	});

	it("encloses a rotated child by its drawn corners", () => {
		// 100x100 at 45°: a diamond reaching 50√2 from its center (50, 50).
		const b = computeGroupBounds([rect(0, 0, 100, 100, 45)]);
		const r = 50 * Math.SQRT2;
		expect(b.x).toBeCloseTo(50 - r);
		expect(b.y).toBeCloseTo(50 - r);
		expect(b.width).toBeCloseTo(2 * r);
		expect(b.height).toBeCloseTo(2 * r);
	});

	it("gives a rotated group the box that hugs its children in its own frame", () => {
		// Two children turned 30° together around (150, 50), as rotating the group does.
		const turned = [rect(0, 0, 100, 100), rect(200, 0, 100, 100)].map((c) => {
			const rad = Math.PI / 6;
			const cx = c.x + 50 - 150;
			const cy = c.y + 50 - 50;
			const nx = 150 + cx * Math.cos(rad) - cy * Math.sin(rad);
			const ny = 50 + cx * Math.sin(rad) + cy * Math.cos(rad);
			return { ...c, x: nx - 50, y: ny - 50, rotation: 30 } as ShapeData;
		});
		const b = computeGroupBounds(turned, 30);
		// Same size as before the turn, still centered on (150, 50).
		expect(b.width).toBeCloseTo(300);
		expect(b.height).toBeCloseTo(100);
		expect(b.x + b.width / 2).toBeCloseTo(150);
		expect(b.y + b.height / 2).toBeCloseTo(50);
		// And every child corner lies on or inside the rotated group box.
		const box = { ...b, rotation: 30 };
		const [g0, g1, , g3] = getShapeCorners(box);
		const ux = { x: g1.x - g0.x, y: g1.y - g0.y };
		const uy = { x: g3.x - g0.x, y: g3.y - g0.y };
		for (const c of turned.flatMap((s) => getShapeCorners(s))) {
			const px = (c.x - g0.x) * ux.x + (c.y - g0.y) * ux.y;
			const py = (c.x - g0.x) * uy.x + (c.y - g0.y) * uy.y;
			expect(px / (ux.x ** 2 + ux.y ** 2)).toBeGreaterThan(-1e-9);
			expect(px / (ux.x ** 2 + ux.y ** 2)).toBeLessThan(1 + 1e-9);
			expect(py / (uy.x ** 2 + uy.y ** 2)).toBeGreaterThan(-1e-9);
			expect(py / (uy.x ** 2 + uy.y ** 2)).toBeLessThan(1 + 1e-9);
		}
	});
});
