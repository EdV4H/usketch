// Range-erase: clear terrain (tilemap.cells) inside a cell box as ONE undoable
// command. Base territory is derived (not stored), so it is not affected here.
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { type CellBox, cellsBounds, parseCellKey } from "./autotile.js";
import type { RangeEraseTargets } from "./range-erase-state.js";
import { isTileMap, type TileMapShapeData } from "./tilemap-shape.js";

export interface RangeEraseDeps {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}

/**
 * Clear terrain tiles inside `box` as one undoable command (no-op if the target
 * is off, there's no tilemap, or nothing in the box changes).
 */
export function eraseRangeBox(
	deps: RangeEraseDeps,
	box: CellBox,
	targets: RangeEraseTargets,
): void {
	const { store, commands, tile } = deps;
	if (!targets.terrain) return;
	let tilemap: TileMapShapeData | undefined;
	for (const [, s] of store.getShapes()) {
		if (isTileMap(s)) {
			tilemap = s;
			break;
		}
	}
	if (!tilemap) return;

	// Sparse-scan existing keys, remove those inside the box.
	const toDelete: string[] = [];
	for (const key of Object.keys(tilemap.cells)) {
		const [c, r] = parseCellKey(key);
		if (c >= box.minC && c <= box.maxC && r >= box.minR && r <= box.maxR) toDelete.push(key);
	}
	if (toDelete.length === 0) return;

	const t = tilemap.tile ?? tile;
	const id = tilemap.id;
	const prevCells = { ...tilemap.cells };
	const nextCells = { ...tilemap.cells };
	for (const k of toDelete) delete nextCells[k];
	const command: Command = {
		execute: () =>
			store.updateShape(id, {
				cells: nextCells,
				...cellsBounds(nextCells, t),
			} as Partial<ShapeData>),
		undo: () =>
			store.updateShape(id, {
				cells: prevCells,
				...cellsBounds(prevCells, t),
			} as Partial<ShapeData>),
	};
	commands.execute(command);
}
