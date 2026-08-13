import type {
	BoardStore,
	CanvasPointerEvent,
	Command,
	CommandRegistry,
	ShapeData,
	ToolContext,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { renderIconAt } from "../icon-render.js";
import { createMapToolDefinition } from "../map-tool.js";
import { isTileMap, makeTileMap, type TileMapShapeData, tilemapBounds } from "../tilemap-shape.js";
import { toolStateStore } from "../tool-state.js";

const TILE = 40;

function makeCtx(initial: ShapeData[] = []) {
	const shapes = new Map<string, ShapeData>(initial.map((s) => [s.id, s]));
	let last: Command | null = null;
	const store = {
		getShapes: () => shapes,
		getShapesSorted: () => [...shapes.values()],
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => shapes.set(s.id, s),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...patch });
		},
		deleteShape: (id: string) => shapes.delete(id),
		setSelection: () => {},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
	} as unknown as BoardStore;
	const commands = {
		execute: (c: Command) => {
			last = c;
			c.execute();
		},
	} as unknown as CommandRegistry;
	const ctx = {
		store,
		commands,
		shapes: { get: () => undefined },
		events: { emit: () => {} },
	} as unknown as ToolContext;
	return { shapes, ctx, getLast: () => last };
}

const at = (x: number, y: number): CanvasPointerEvent =>
	({ worldPoint: { x, y } }) as unknown as CanvasPointerEvent;

const theTilemap = (shapes: Map<string, ShapeData>): TileMapShapeData | undefined =>
	[...shapes.values()].find(isTileMap) as TileMapShapeData | undefined;

const tilemapWith = (icons: Record<string, string>, cells: Record<string, string> = {}) =>
	({ ...makeTileMap(TILE), id: "tm", cells, icons }) as unknown as ShapeData;

describe("map tool — icon grid (stamp)", () => {
	it("stamps the active icon into the clicked cell, creating a tilemap on a blank board", () => {
		const { shapes, ctx } = makeCtx();
		toolStateStore.set({ mode: "stamp", iconKey: "town" });
		const tool = createMapToolDefinition(TILE);
		tool.onPointerDown?.(ctx, at(20, 20)); // cell 0,0
		const tm = theTilemap(shapes);
		expect(tm?.icons?.["0,0"]).toBe("town");
	});

	it("is one-icon-per-cell — re-stamping overwrites", () => {
		const { shapes, ctx } = makeCtx([tilemapWith({ "0,0": "town" })]);
		toolStateStore.set({ mode: "stamp", iconKey: "castle" });
		const tool = createMapToolDefinition(TILE);
		tool.onPointerDown?.(ctx, at(20, 20));
		expect(theTilemap(shapes)?.icons?.["0,0"]).toBe("castle");
	});

	it("commits one undoable command — undo removes the stamped icon", () => {
		const { shapes, ctx, getLast } = makeCtx([tilemapWith({})]);
		toolStateStore.set({ mode: "stamp", iconKey: "town" });
		const tool = createMapToolDefinition(TILE);
		tool.onPointerDown?.(ctx, at(20, 20));
		expect(theTilemap(shapes)?.icons?.["0,0"]).toBe("town");
		getLast()?.undo();
		expect(theTilemap(shapes)?.icons?.["0,0"]).toBeUndefined();
	});
});

describe("map tool — icon grid (eraser)", () => {
	it("erases the icon first (priority), leaving terrain", () => {
		const { shapes, ctx } = makeCtx([tilemapWith({ "0,0": "town" }, { "0,0": "grass" })]);
		toolStateStore.set({ mode: "eraser" });
		const tool = createMapToolDefinition(TILE);
		tool.onPointerDown?.(ctx, at(20, 20));
		tool.onPointerUp?.(ctx, at(20, 20));
		const tm = theTilemap(shapes);
		expect(tm?.icons?.["0,0"]).toBeUndefined(); // icon gone
		expect(tm?.cells?.["0,0"]).toBe("grass"); // terrain kept
	});

	it("erases the terrain cell when there's no icon on it", () => {
		const { shapes, ctx } = makeCtx([tilemapWith({}, { "0,0": "grass" })]);
		toolStateStore.set({ mode: "eraser" });
		const tool = createMapToolDefinition(TILE);
		tool.onPointerDown?.(ctx, at(20, 20));
		tool.onPointerUp?.(ctx, at(20, 20));
		expect(theTilemap(shapes)?.cells?.["0,0"]).toBeUndefined();
	});
});

describe("tilemapBounds", () => {
	it("encloses both painted cells and placed icons", () => {
		const b = tilemapBounds({ "0,0": "grass" }, { "5,5": "town" }, TILE);
		expect(b).toEqual({ x: 0, y: 0, width: 6 * TILE, height: 6 * TILE });
	});

	it("is a zero box when both are empty", () => {
		expect(tilemapBounds({}, {}, TILE)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});
});

describe("renderIconAt", () => {
	it("returns null for an unknown icon key", () => {
		expect(renderIconAt("no-such-icon", 0, 0, TILE)).toBeNull();
	});
	it("returns an element for a known icon key", () => {
		expect(renderIconAt("town", 1, 2, TILE)).not.toBeNull();
	});
});
