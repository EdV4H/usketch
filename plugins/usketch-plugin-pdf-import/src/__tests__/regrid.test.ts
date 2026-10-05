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

	it("reads a first row of mixed heights in full, laid out as the grid lays it out", () => {
		// A 400-tall page next to two 100-tall ones: the short pages sit 150
		// below the cell top, past half the *shortest* page (50).
		const tall = { height: 400 };
		const short = { height: 100 };
		const pages = [
			page(1, 0, 0, tall),
			page(2, 120, 150, short),
			page(3, 240, 150, short),
			page(4, 0, 420, tall),
		];
		expect(detectColumns(pages)).toBe(3);
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
		expect(ordered.map((p) => p.id)).toEqual(["b1", "b2", "a1", "a2"]);
	});

	it("orders documents by where their first pages sit, not by asset id", () => {
		// Imported left to right: "z" first, then "a". Asset ids are content
		// hashes, so their sort order says nothing about which came first.
		const z = { assetId: "asset:z", fileName: "z.pdf" };
		const a = { assetId: "asset:a", fileName: "a.pdf" };
		const pages = [
			page(1, 0, 0, { id: "z1", ...z }),
			page(2, 0, 220, { id: "z2", ...z }),
			page(1, 300, 0, { id: "a1", ...a }),
			page(2, 300, 220, { id: "a2", ...a }),
		];

		const first = reflowPages(pages, 4, 20);
		const order = (patches: { id: string; x: number }[]) =>
			[...patches].sort((p, q) => p.x - q.x).map((p) => p.id);
		expect(order(first)).toEqual(["z1", "z2", "a1", "a2"]);

		// ...and stays that way however often the grid is reflowed.
		let current = pages;
		for (const columns of [1, 3, 2, 4]) {
			const patches = new Map(reflowPages(current, columns, 20).map((p) => [p.id, p]));
			current = current.map((p) => ({ ...p, ...patches.get(p.id) }));
		}
		expect(order(reflowPages(current, 4, 20))).toEqual(["z1", "z2", "a1", "a2"]);
	});

	it("does not creep downward when the tallest page is not in the first row", () => {
		// Short pages centered in cells as tall as page 3 (cell top at -100).
		let current = [
			page(1, 0, 0, { height: 100 }),
			page(2, 120, 0, { height: 100 }),
			page(3, 240, 0, { height: 300 }),
			page(4, 360, 0, { height: 100 }),
		];
		const tops: number[] = [];
		for (const columns of [2, 4, 2, 4, 2]) {
			const patches = new Map(reflowPages(current, columns, 20).map((p) => [p.id, p]));
			current = current.map((p) => ({ ...p, ...patches.get(p.id) }));
			tops.push(Math.min(...current.map((p) => p.y)));
		}
		expect(new Set(tops.filter((_, i) => i % 2 === 0)).size).toBe(1); // every 2-column pass
		expect(new Set(tops.filter((_, i) => i % 2 === 1)).size).toBe(1); // every 4-column pass
		// The first page sits where it started: centered in a cell whose top is
		// 100 above it, the inset page 3's height gives every shorter page.
		expect(current.find((p) => p.id === "p1")?.y).toBe(0);
	});

	it("does not drift sideways when the widest page is not in the first column", () => {
		let current = [
			page(1, 0, 0, { width: 50 }),
			page(2, 120, 0, { width: 100 }),
			page(3, 0, 220, { width: 50 }),
			page(4, 120, 220, { width: 100 }),
		];
		const lefts: number[] = [];
		for (const columns of [1, 2, 1, 2]) {
			const patches = new Map(reflowPages(current, columns, 20).map((p) => [p.id, p]));
			current = current.map((p) => ({ ...p, ...patches.get(p.id) }));
			lefts.push(Math.min(...current.map((p) => p.x)));
		}
		expect(lefts[0]).toBe(lefts[2]);
		expect(lefts[1]).toBe(lefts[3]);
	});

	// Pinning the top edge keeps the first row where the user is looking while
	// they step through column counts.
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
