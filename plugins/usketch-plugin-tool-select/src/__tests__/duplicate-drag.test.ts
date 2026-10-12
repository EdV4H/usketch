import type { LayerRenderContext, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	cloneAtCurrentPositions,
	duplicateTargetIds,
	previewRenderContext,
	previewSnapCandidates,
	restoreShapes,
} from "../duplicate-drag.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: overrides.id ?? "s1",
		type: overrides.type ?? "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("cloneAtCurrentPositions", () => {
	it("copies the moving shapes where they are now, with internal references rewired", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame", x: 200 }));
		store.addShape(makeShape({ id: "child", parentId: "frame", x: 210 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "child", targetId: "X" }));

		const clones = cloneAtCurrentPositions(store, ["frame", "child", "C"]);

		expect(clones).toHaveLength(3);
		const ids = new Set(clones.map((c) => c.id));
		expect(ids.has("frame")).toBe(false);
		const frame = clones.find((c) => c.type === "frame");
		const child = clones.find((c) => c.type === "rectangle");
		const conn = clones.find((c) => c.type === "connector");
		expect(frame?.x).toBe(200);
		expect(child?.parentId).toBe(frame?.id);
		expect(conn?.sourceId).toBe(child?.id);
		expect(conn?.targetId).toBe("X");
		// Store is untouched — the caller commits the clones through a command.
		expect(store.getShapes().size).toBe(3);
	});
});

describe("restoreShapes", () => {
	it("writes the snapshots back and skips shapes that are gone", () => {
		const store = createBoardStore();
		const start = makeShape({ id: "a", x: 0, y: 0 });
		store.addShape(start);
		store.updateShape("a", { x: 3, y: -2 });

		restoreShapes(store, [start, makeShape({ id: "gone" })]);

		expect(store.getShape("a")).toMatchObject({ x: 0, y: 0 });
		expect(store.getShape("gone")).toBeUndefined();
	});
});

describe("duplicateTargetIds", () => {
	it("adds connectors running between the moving shapes (frame children)", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
		store.addShape(makeShape({ id: "A", parentId: "frame" }));
		store.addShape(makeShape({ id: "B", parentId: "frame", x: 300 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }));
		store.addShape(makeShape({ id: "out", type: "connector", sourceId: "A", targetId: "Z" }));

		expect(duplicateTargetIds(store, ["frame", "A", "B"])).toEqual(["frame", "A", "B", "C"]);
	});
});

describe("previewRenderContext", () => {
	it("renders only the snapshots, sorted by zIndex, with nothing selected or hovered", () => {
		const base = {
			shapes: new Map([["real", makeShape({ id: "real" })]]),
			shapesSorted: [makeShape({ id: "real" })],
			selection: new Set(["real"]),
			hoveredShapeId: "real",
			renderMode: "normal",
		} as unknown as LayerRenderContext;
		const child = makeShape({ id: "child", parentId: "frame", zIndex: "a2" });
		const frame = makeShape({ id: "frame", type: "frame", zIndex: "a1" });

		const ctx = previewRenderContext(base, [child, frame]);

		expect([...ctx.shapes.keys()].sort()).toEqual(["child", "frame"]);
		expect(ctx.shapesSorted.map((s) => s.id)).toEqual(["frame", "child"]);
		expect(ctx.selection.size).toBe(0);
		expect(ctx.hoveredShapeId).toBeNull();
		expect(ctx.renderMode).toBe("normal");
	});

	it("renders snapshots as not editing so a preview never mounts (and focuses) a text editor", () => {
		const base = {
			shapes: new Map(),
			shapesSorted: [],
			selection: new Set(),
		} as unknown as LayerRenderContext;
		const ctx = previewRenderContext(base, [makeShape({ id: "a", isEditing: true })]);
		expect(ctx.shapes.get("a")?.isEditing).toBe(false);
		expect(ctx.shapesSorted[0]?.isEditing).toBe(false);
	});
});

describe("previewSnapCandidates", () => {
	it("returns the bounds of the top-level snapshots, skipping children and connectors", () => {
		const frame = makeShape({ id: "frame", type: "frame", x: 10, y: 20, width: 300, height: 200 });
		const child = makeShape({ id: "child", parentId: "frame", x: 30, y: 40 });
		const conn = makeShape({ id: "C", type: "connector", x: 0, y: 0, width: 5, height: 5 });
		const other = makeShape({ id: "inOuter", parentId: "outer", x: 500, y: 0 });

		expect(previewSnapCandidates([frame, child, conn, other])).toEqual([
			{ x: 10, y: 20, width: 300, height: 200 },
			{ x: 500, y: 0, width: 100, height: 100 },
		]);
	});

	it("uses ShapeDefinition.getBounds when the registry has one", () => {
		const registry = {
			get: () => ({
				getBounds: (s: ShapeData) => ({ x: s.x - 1, y: s.y - 1, width: 2, height: 2 }),
			}),
		} as unknown as ShapeRegistry;
		expect(previewSnapCandidates([makeShape({ id: "a", x: 5, y: 5 })], registry)).toEqual([
			{ x: 4, y: 4, width: 2, height: 2 },
		]);
	});
});
