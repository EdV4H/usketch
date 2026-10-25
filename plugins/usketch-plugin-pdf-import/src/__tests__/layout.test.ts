import { describe, expect, it } from "vitest";
import { layoutPagesInGrid } from "../layout.js";

const CENTER = { x: 0, y: 0 };

function uniformPages(count: number, width = 100, height = 200) {
	return Array.from({ length: count }, () => ({ width, height }));
}

describe("layoutPagesInGrid", () => {
	it("returns an empty layout for zero pages", () => {
		const result = layoutPagesInGrid(uniformPages(0), { gap: 24, center: CENTER });
		expect(result.positions).toEqual([]);
		expect(result.width).toBe(0);
		expect(result.height).toBe(0);
	});

	it("reports the grid's bounding box so callers can frame the import", () => {
		const result = layoutPagesInGrid(uniformPages(4), { gap: 20, center: { x: 100, y: 50 } });
		expect(result).toMatchObject({ x: -10, y: -160, width: 220, height: 420 });
	});

	it("centers a single page on the given world point", () => {
		const result = layoutPagesInGrid(uniformPages(1), { gap: 24, center: { x: 500, y: 300 } });
		expect(result.cols).toBe(1);
		expect(result.rows).toBe(1);
		expect(result.positions).toEqual([{ x: 450, y: 200 }]);
	});

	it("lays 4 pages out as a 2x2 grid, row-major", () => {
		const result = layoutPagesInGrid(uniformPages(4), { gap: 20, center: CENTER });
		expect(result.cols).toBe(2);
		expect(result.rows).toBe(2);
		// grid: 2*100 + 20 = 220 wide, 2*200 + 20 = 420 tall → origin (-110, -210)
		expect(result.width).toBe(220);
		expect(result.height).toBe(420);
		expect(result.positions).toEqual([
			{ x: -110, y: -210 },
			{ x: 10, y: -210 },
			{ x: -110, y: 10 },
			{ x: 10, y: 10 },
		]);
	});

	it("uses ceil(sqrt(n)) columns so 5 pages become 3 columns over 2 rows", () => {
		const result = layoutPagesInGrid(uniformPages(5), { gap: 20, center: CENTER });
		expect(result.cols).toBe(3);
		expect(result.rows).toBe(2);
		// The trailing row is partially filled; pages still flow left-to-right.
		expect(result.positions).toHaveLength(5);
		expect(result.positions[3]?.y).toBe(result.positions[4]?.y);
		expect(result.positions[0]?.y).toBeLessThan(result.positions[3]?.y ?? 0);
	});

	it("sizes cells to the largest page and centers smaller pages within them", () => {
		const pages = [
			{ width: 100, height: 200 },
			{ width: 50, height: 100 },
		];
		const result = layoutPagesInGrid(pages, { gap: 0, center: CENTER });
		expect(result.cols).toBe(2);
		// Cell is 100x200; the small page is centered inside its own cell.
		expect(result.positions[0]).toEqual({ x: -100, y: -100 });
		expect(result.positions[1]).toEqual({ x: 25, y: -50 });
	});

	it("rounds positions to integers", () => {
		const result = layoutPagesInGrid([{ width: 101, height: 201 }], {
			gap: 24,
			center: { x: 0.5, y: 0.5 },
		});
		const first = result.positions[0];
		expect(first).toBeDefined();
		expect(Number.isInteger(first?.x)).toBe(true);
		expect(Number.isInteger(first?.y)).toBe(true);
	});
});
