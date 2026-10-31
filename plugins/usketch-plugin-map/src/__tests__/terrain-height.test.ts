import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import type { Cells } from "../autotile.js";
import { chunkArea } from "../map-layer.js";
import { computeRelief, reliefChunkMarkup, wallStyle } from "../map-relief-layer.js";
import { renderConfigStore } from "../render-config.js";
import { TERRAIN_KEYS, type TerrainKey } from "../terrain.js";
import {
	boardTerrainSampler,
	groundHeightAt,
	LEVEL_HEIGHT,
	TERRAIN_LEVELS,
	terrainLevel,
} from "../terrain-height.js";
import { makeTileMap } from "../tilemap-shape.js";

const TILE = 40;

function storeWith(cells: Cells): BoardStore {
	const tm: ShapeData = { ...makeTileMap(TILE), id: "tm", cells } as ShapeData;
	const shapes = new Map<string, ShapeData>([[tm.id, tm]]);
	return {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
	} as unknown as BoardStore;
}

describe("terrain levels", () => {
	it("covers every terrain, with sea lowest and snow highest", () => {
		for (const key of TERRAIN_KEYS) expect(TERRAIN_LEVELS[key]).toBeGreaterThanOrEqual(0);
		expect(terrainLevel("water")).toBe(0);
		expect(terrainLevel("grass")).toBe(1);
		expect(terrainLevel("mtn")).toBeGreaterThan(terrainLevel("forest"));
		expect(terrainLevel("snow")).toBeGreaterThan(terrainLevel("mtn"));
		expect(terrainLevel(undefined)).toBe(0);
	});
});

describe("groundHeightAt", () => {
	it("reads the painted cell under a world point", () => {
		renderConfigStore.set({ emptyTerrain: "water" });
		const store = storeWith({ "0,0": "grass", "1,0": "mtn" });
		expect(groundHeightAt(store, 10, 10, TILE)).toBe(LEVEL_HEIGHT);
		expect(groundHeightAt(store, 50, 10, TILE)).toBe(3 * LEVEL_HEIGHT);
		expect(groundHeightAt(store, 500, 500, TILE)).toBe(0); // empty = water
	});

	it("reuses the sampler until the shapes or render config change", () => {
		renderConfigStore.set({ emptyTerrain: "water" });
		let shapes = storeWith({ "0,0": "grass" }).getShapes();
		const store = { getShapes: () => shapes } as unknown as BoardStore;
		const first = boardTerrainSampler(store);
		expect(boardTerrainSampler(store)).toBe(first);
		shapes = storeWith({ "0,0": "mtn" }).getShapes();
		expect(groundHeightAt(store, 10, 10, TILE)).toBe(3 * LEVEL_HEIGHT);
		const second = boardTerrainSampler(store);
		renderConfigStore.set({ emptyTerrain: "sand" });
		expect(boardTerrainSampler(store)).not.toBe(second);
		expect(groundHeightAt(store, 500, 500, TILE)).toBe(LEVEL_HEIGHT);
		renderConfigStore.set({ emptyTerrain: "water" });
	});
});

describe("computeRelief", () => {
	const cells: Cells = { "0,0": "grass", "1,0": "mtn" };
	const sample = (c: number, r: number) => cells[`${c},${r}`] ?? "water";

	it("lifts raised cells by level and walls every lower edge", () => {
		const relief = computeRelief(sample, { c0: -1, c1: 2, r0: -1, r1: 1 });
		expect([...relief.tops.entries()].map(([l, t]) => [l, t.map((c) => c.key)])).toEqual([
			[1, ["0,0"]],
			[3, ["1,0"]],
		]);
		const walls = Object.fromEntries(relief.walls.map((w) => [w.key, [w.bottom, w.top]]));
		// grass: water on n/s/w (0→1), the mountain to the east is higher (no wall).
		expect(walls["0,0:n"]).toEqual([0, 1]);
		expect(walls["0,0:w"]).toEqual([0, 1]);
		expect(walls["0,0:e"]).toBeUndefined();
		// mountain: its west wall stands on the grass (1→3), the rest on the sea.
		expect(walls["1,0:w"]).toEqual([1, 3]);
		expect(walls["1,0:e"]).toEqual([0, 3]);
	});
	it("merges a run of matching edges into one wall", () => {
		const row: Cells = { "0,0": "grass", "1,0": "grass", "2,0": "grass", "3,0": "mtn" };
		const at = (c: number, r: number) => row[`${c},${r}`] ?? "water";
		const relief = computeRelief(at, { c0: 0, c1: 3, r0: 0, r1: 0 });
		const north = relief.walls.filter((w) => w.side === "n");
		// Three grass cells share one north wall; the mountain's differs in height.
		expect(north.map((w) => [w.col, w.length, w.top])).toEqual([
			[0, 3, 1],
			[3, 1, 3],
		]);
	});
});

describe("wallStyle", () => {
	it("folds a south wall down from its top level along the cells' bottom edge", () => {
		const style = wallStyle(
			{ key: "k", col: 1, row: 2, side: "s", length: 2, top: 3, bottom: 1, terrain: "mtn" },
			TILE,
			2,
		);
		expect(style).toMatchObject({
			left: 1 * TILE * 2,
			top: 3 * TILE * 2,
			width: 2 * TILE * 2,
			height: 2 * LEVEL_HEIGHT * 2,
			transform: `translateZ(${3 * LEVEL_HEIGHT * 2}px) rotateX(-90deg)`,
		});
	});
});

describe("chunkArea", () => {
	it("snaps the drawn area out to whole chunks", () => {
		const a = chunkArea({ left: 10, top: -5, right: 110, bottom: 45 } as DOMRectReadOnly, TILE);
		const chunk = 16 * TILE;
		expect(a && [a.left, a.top, a.right, a.bottom]).toEqual([0, -chunk, chunk, chunk]);
	});
});

describe("reliefChunkMarkup", () => {
	it("draws the walls and lifted faces of raised cells", () => {
		// A stone cell (level 2) in water: four walls and one face.
		const sample = (c: number, r: number) => (c === 1 && r === 1 ? "stone" : "water") as TerrainKey;
		const html = reliefChunkMarkup(sample, { c0: 0, c1: 2, r0: 0, r1: 2 }, TILE, 1);
		expect(html.match(/<div /g)).toHaveLength(4);
		expect(html).toContain("translateZ(32px)");
		expect(html).toContain("url(#uskmap-pat-stone)");
	});

	it("never writes out an unknown terrain", () => {
		const sample = () => "constructor" as TerrainKey;
		expect(reliefChunkMarkup(sample, { c0: 0, c1: 1, r0: 0, r1: 1 }, TILE, 1)).toBe("");
	});
});
