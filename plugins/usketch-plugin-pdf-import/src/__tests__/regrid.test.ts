import { describe, expect, it } from "vitest";
import { detectColumns, reflowPages } from "../regrid.js";
import type { PdfPageShapeData } from "../types.js";

function page(
	pageNumber: number,
	x: number,
	y: number,
	overrides: Partial<PdfPageShapeData> = {},
): PdfPageShapeData {
	return {
		id: `p${pageNumber}`,
		type: "pdf-page",
		x,
		y,
		width: 100,
		height: 200,
		style: { fill: "#fff", stroke: "#eee", strokeWidth: 1, opacity: 1 },
		assetId: "asset:a",
		pageNumber,
		pageCount: 6,
		fileName: "a.pdf",
		pointWidth: 595,
		pointHeight: 842,
		...overrides,
	};
}

/** 3 columns x 2 rows, cell 100x200, gap 20. */
function grid3x2(): PdfPageShapeData[] {
	return [
		page(1, 0, 0),
		page(2, 120, 0),
		page(3, 240, 0),
		page(4, 0, 220),
		page(5, 120, 220),
		page(6, 240, 220),
	];
}

describe("detectColumns", () => {
	it("counts the pages sharing the top row", () => {
		expect(detectColumns(grid3x2())).toBe(3);
	});

	it("treats a single row as all-columns", () => {
		expect(detectColumns([page(1, 0, 0), page(2, 120, 0)])).toBe(2);
	});

	it("treats a single column as one", () => {
		expect(detectColumns([page(1, 0, 0), page(2, 0, 220)])).toBe(1);
	});

	it("tolerates small vertical differences within a row", () => {
		// Pages of differing heights are centered in their cell, so their `y`
		// values within one row are close but not identical.
		expect(detectColumns([page(1, 0, 0), page(2, 120, 6), page(3, 0, 220)])).toBe(2);
	});

	it("returns 0 for an empty selection", () => {
		expect(detectColumns([])).toBe(0);
	});
});

describe("reflowPages", () => {
	it("rearranges pages into the requested column count", () => {
		const patches = reflowPages(grid3x2(), 2, 20);
		const byId = new Map(patches.map((p) => [p.id, p]));

		// 2 columns → 3 rows; pages 1&2 share a row, 3&4 the next.
		expect(byId.get("p1")?.y).toBe(byId.get("p2")?.y);
		expect(byId.get("p3")?.y).toBe(byId.get("p4")?.y);
		expect(byId.get("p1")?.y).toBeLessThan(byId.get("p3")?.y ?? 0);
		expect(byId.get("p1")?.x).toBe(byId.get("p3")?.x);
	});

	it("keeps pages in page-number order regardless of their current positions", () => {
		const shuffled = [page(3, 999, 999), page(1, 0, 0), page(2, 500, 0)];
		const patches = reflowPages(shuffled, 3, 20);

		const ordered = [...patches].sort((a, b) => a.x - b.x);
		expect(ordered.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
	});

	it("groups pages by source document before ordering by page", () => {
		const mixed = [
			page(1, 0, 0, { id: "b1", assetId: "asset:b", fileName: "b.pdf" }),
			page(1, 200, 0, { id: "a1", assetId: "asset:a", fileName: "a.pdf" }),
			page(2, 400, 0, { id: "b2", assetId: "asset:b", fileName: "b.pdf" }),
			page(2, 600, 0, { id: "a2", assetId: "asset:a", fileName: "a.pdf" }),
		];
		const patches = reflowPages(mixed, 4, 20);

		const ordered = [...patches].sort((a, b) => a.x - b.x);
		expect(ordered.map((p) => p.id)).toEqual(["a1", "a2", "b1", "b2"]);
	});

	// The grid toolbar is anchored to the selection's top edge and horizontal
	// center, so both must survive a reflow or the bar jumps out from under the
	// cursor between clicks.
	it("keeps the top edge fixed however the row count changes", () => {
		const before = grid3x2();
		const topBefore = Math.min(...before.map((s) => s.y));

		for (const columns of [1, 2, 4, 6]) {
			const patches = reflowPages(before, columns, 20);
			expect(Math.min(...patches.map((p) => p.y))).toBe(topBefore);
		}
	});

	it("keeps the horizontal center fixed however the column count changes", () => {
		const before = grid3x2();
		const centerBefore =
			(Math.min(...before.map((s) => s.x)) + Math.max(...before.map((s) => s.x + s.width))) / 2;

		for (const columns of [1, 2, 4, 6]) {
			const patches = reflowPages(before, columns, 20);
			const centerAfter =
				(Math.min(...patches.map((p) => p.x)) + Math.max(...patches.map((p) => p.x + 100))) / 2;
			expect(centerAfter).toBeCloseTo(centerBefore, 0);
		}
	});

	it("grows downward rather than upward when rows are added", () => {
		const oneRow = [page(1, 0, 0), page(2, 120, 0), page(3, 240, 0)];
		const patches = reflowPages(oneRow, 1, 20);

		expect(Math.min(...patches.map((p) => p.y))).toBe(0);
		expect(Math.max(...patches.map((p) => p.y))).toBeGreaterThan(0);
	});

	it("clamps a nonsensical column count to at least one", () => {
		const patches = reflowPages(grid3x2(), 0, 20);
		expect(new Set(patches.map((p) => p.x)).size).toBe(1);
	});

	it("never asks for more columns than there are pages", () => {
		const patches = reflowPages(grid3x2(), 99, 20);
		expect(new Set(patches.map((p) => p.y)).size).toBe(1);
	});

	it("returns nothing to do for an empty selection", () => {
		expect(reflowPages([], 3, 20)).toEqual([]);
	});
});
