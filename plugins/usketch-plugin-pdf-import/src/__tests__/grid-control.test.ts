import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	createSetPdfColumnsCommand,
	getSelectedPdfColumns,
	selectedPdfPages,
	squareColumns,
} from "../grid-control.js";
import type { PdfPageShapeData } from "../types.js";

function page(pageNumber: number, x: number, y: number): PdfPageShapeData {
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
		pageCount: 4,
		fileName: "a.pdf",
		pointWidth: 595,
		pointHeight: 842,
	};
}

/** Minimal in-memory store: just what the grid control reads and writes. */
function fakeStore(shapes: ShapeData[], selection: string[]): BoardStore {
	const map = new Map(shapes.map((s) => [s.id, { ...s }]));
	return {
		getShapes: () => map,
		getSelection: () => new Set(selection),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const shape = map.get(id);
			if (shape) map.set(id, { ...shape, ...patch });
		},
	} as unknown as BoardStore;
}

/** 2 x 2, cell 100x200, gap 20. */
function grid2x2(): PdfPageShapeData[] {
	return [page(1, 0, 0), page(2, 120, 0), page(3, 0, 220), page(4, 120, 220)];
}

const allIds = ["p1", "p2", "p3", "p4"];

describe("selectedPdfPages", () => {
	it("keeps only PDF pages from the selection", () => {
		const sticky = { ...page(9, 0, 0), id: "sticky", type: "sticky" } as ShapeData;
		const store = fakeStore([...grid2x2(), sticky], ["p1", "sticky", "p2"]);
		expect(selectedPdfPages(store).map((p) => p.id)).toEqual(["p1", "p2"]);
	});
});

describe("getSelectedPdfColumns", () => {
	it("reads the column count from the selected pages' positions", () => {
		expect(getSelectedPdfColumns(fakeStore(grid2x2(), allIds))).toBe(2);
	});

	it("is 0 when fewer than two pages are selected", () => {
		expect(getSelectedPdfColumns(fakeStore(grid2x2(), ["p1"]))).toBe(0);
		expect(getSelectedPdfColumns(fakeStore(grid2x2(), []))).toBe(0);
	});
});

describe("createSetPdfColumnsCommand", () => {
	it("rearranges the selection and undoes back to where the pages were", () => {
		const store = fakeStore(grid2x2(), allIds);

		const command = createSetPdfColumnsCommand(store, 4, 20);
		expect(command).not.toBeNull();
		command?.execute();
		expect(getSelectedPdfColumns(store)).toBe(4);

		command?.undo();
		expect(getSelectedPdfColumns(store)).toBe(2);
		expect(store.getShapes().get("p3")).toMatchObject({ x: 0, y: 220 });
	});

	it("clamps the request to the number of selected pages", () => {
		const store = fakeStore(grid2x2(), allIds);
		createSetPdfColumnsCommand(store, 99, 20)?.execute();
		expect(getSelectedPdfColumns(store)).toBe(4);
	});

	it("does nothing without a multi-page selection or a usable number", () => {
		expect(createSetPdfColumnsCommand(fakeStore(grid2x2(), ["p1"]), 2, 20)).toBeNull();
		expect(createSetPdfColumnsCommand(fakeStore(grid2x2(), allIds), Number.NaN, 20)).toBeNull();
	});

	it("does nothing when the pages already sit in that arrangement", () => {
		expect(createSetPdfColumnsCommand(fakeStore(grid2x2(), allIds), 2, 20)).toBeNull();
	});
});

describe("squareColumns", () => {
	it("matches the roughly square grid a fresh import gets", () => {
		expect(squareColumns(4)).toBe(2);
		expect(squareColumns(9)).toBe(3);
		expect(squareColumns(10)).toBe(4);
		expect(squareColumns(0)).toBe(1);
	});
});
