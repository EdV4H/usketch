// Applies a generator into a bounded cell box of the (single) tilemap, as one
// undoable command. Shared by the map tool (drag-range) and the palette
// (view / regenerate).
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { type CellBox, type Cells, cellKey, cellsBounds } from "./autotile.js";
import { genStateStore } from "./gen-state.js";
import { GENERATORS_BY_ID } from "./generators/index.js";
import { isTileMap, makeTileMap, type TileMapShapeData } from "./tilemap-shape.js";

/** Hard cap so a zoomed-out "view" generation can't explode into millions of cells. */
const MAX_BOX_DIM = 256;

export interface GenerateDeps {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}

/** The single shared tilemap, creating it (live) if none exists yet. */
export function resolveTilemap(store: BoardStore, tile: number): { id: string; created: boolean } {
	for (const [, s] of store.getShapes()) {
		if (isTileMap(s)) return { id: s.id, created: false };
	}
	const tm = makeTileMap(tile);
	store.addShape(tm);
	return { id: tm.id, created: true };
}

/** Clamp a box to a maximum dimension, centered, so generation stays bounded. */
export function clampBox(box: CellBox): CellBox {
	const w = box.maxC - box.minC + 1;
	const h = box.maxR - box.minR + 1;
	if (w <= MAX_BOX_DIM && h <= MAX_BOX_DIM) return box;
	const cc = Math.round((box.minC + box.maxC) / 2);
	const cr = Math.round((box.minR + box.maxR) / 2);
	const half = Math.floor(MAX_BOX_DIM / 2);
	// Exactly MAX_BOX_DIM cells wide/tall when clamping (inclusive bounds).
	return {
		minC: w > MAX_BOX_DIM ? cc - half : box.minC,
		maxC: w > MAX_BOX_DIM ? cc - half + MAX_BOX_DIM - 1 : box.maxC,
		minR: h > MAX_BOX_DIM ? cr - half : box.minR,
		maxR: h > MAX_BOX_DIM ? cr - half + MAX_BOX_DIM - 1 : box.maxR,
	};
}

/** The visible viewport as a cell box ("全体" = current view on the infinite canvas). */
export function viewportCellBox(store: BoardStore, tile: number): CellBox {
	const vp = store.getViewport();
	const w = typeof window !== "undefined" ? window.innerWidth : 800;
	const h = typeof window !== "undefined" ? window.innerHeight : 600;
	const left = -vp.x / vp.zoom;
	const top = -vp.y / vp.zoom;
	const right = (w - vp.x) / vp.zoom;
	const bottom = (h - vp.y) / vp.zoom;
	return clampBox({
		minC: Math.floor(left / tile),
		minR: Math.floor(top / tile),
		maxC: Math.floor((right - 1) / tile),
		maxR: Math.floor((bottom - 1) / tile),
	});
}

export interface GenerateRequest {
	generatorId: string;
	seed: number;
	params: Record<string, number>;
	box: CellBox;
}

/**
 * Generate terrain into `box`, replacing existing cells inside it (cells outside
 * are untouched), and commit as one undoable command.
 */
export function generateIntoBox(deps: GenerateDeps, req: GenerateRequest): void {
	const gen = GENERATORS_BY_ID.get(req.generatorId);
	if (!gen) return;
	const box = clampBox(req.box);
	if (box.maxC < box.minC || box.maxR < box.minR) return;

	const { id, created } = resolveTilemap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as TileMapShapeData | undefined;
	if (!shape) return;
	const tile = shape.tile ?? deps.tile;

	const prev: Cells = { ...shape.cells };
	const next: Cells = { ...shape.cells };
	// Clear the target box, then lay down the generated field.
	for (let r = box.minR; r <= box.maxR; r++) {
		for (let c = box.minC; c <= box.maxC; c++) delete next[cellKey(c, r)];
	}
	Object.assign(next, gen.generate({ box, seed: req.seed, params: req.params }));

	const prevBounds = cellsBounds(prev, tile);
	const nextBounds = cellsBounds(next, tile);
	if (created) {
		// Newly created this action: commit as an add so undo deletes it and redo
		// re-adds it (updateShape on a deleted id would no-op, breaking redo).
		const finalShape = { ...shape, cells: next, ...nextBounds } as ShapeData;
		deps.store.deleteShape(id);
		deps.commands.execute(createAddShapeCommand(deps.store, finalShape));
	} else {
		const command: Command = {
			execute: () =>
				deps.store.updateShape(id, { cells: next, ...nextBounds } as Partial<ShapeData>),
			undo: () => deps.store.updateShape(id, { cells: prev, ...prevBounds } as Partial<ShapeData>),
		};
		deps.commands.execute(command);
	}
	genStateStore.set({ lastBox: box });
}
