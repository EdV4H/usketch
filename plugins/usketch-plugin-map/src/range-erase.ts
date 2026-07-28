// Range-erase: clear terrain (tilemap.cells) AND team ownership (team-map.owner)
// inside a cell box, as ONE undoable command. Shared by the range-erase tool.
import type {
	BoardStore,
	BoundingBox,
	Command,
	CommandRegistry,
	ShapeData,
} from "@edv4h/usketch-shared";
import { type CellBox, cellsBounds, parseCellKey } from "./autotile.js";
import { isTeamMap, ownerBounds } from "./team/team-map-shape.js";
import { isTileMap } from "./tilemap-shape.js";

export interface RangeEraseDeps {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}

interface ClearOp {
	id: string;
	prev: Partial<ShapeData>;
	next: Partial<ShapeData>;
}

// One shape's box-clear: sparse-scan existing keys, remove those in `box`. Returns
// the store patch pair (or null when nothing changes). `field` is the intrinsic
// sparse map ("cells" for tilemap, "owner" for team-map).
function boxClearOp<M extends Record<string, string>>(
	shapeId: string,
	map: M,
	field: "cells" | "owner",
	box: CellBox,
	bounds: (m: M) => BoundingBox,
): ClearOp | null {
	const toDelete: string[] = [];
	for (const key of Object.keys(map)) {
		const [c, r] = parseCellKey(key);
		if (c >= box.minC && c <= box.maxC && r >= box.minR && r <= box.maxR) toDelete.push(key);
	}
	if (toDelete.length === 0) return null; // no-op → don't clone
	const prevMap = { ...map };
	const nextMap = { ...map };
	for (const k of toDelete) delete nextMap[k];
	return {
		id: shapeId,
		prev: { [field]: prevMap, ...bounds(prevMap) } as Partial<ShapeData>,
		next: { [field]: nextMap, ...bounds(nextMap) } as Partial<ShapeData>,
	};
}

/** Clear terrain + team ownership inside `box` as one undoable command (no-op if empty). */
export function eraseRangeBox(deps: RangeEraseDeps, box: CellBox): void {
	const { store, commands, tile } = deps;
	const ops: ClearOp[] = [];
	for (const [, s] of store.getShapes()) {
		// Use each shape's own tile size (boards may differ from the tool default).
		if (isTileMap(s)) {
			const t = s.tile ?? tile;
			const op = boxClearOp(s.id, s.cells, "cells", box, (m) => cellsBounds(m, t));
			if (op) ops.push(op);
		} else if (isTeamMap(s)) {
			const t = s.tile ?? tile;
			const op = boxClearOp(s.id, s.owner, "owner", box, (m) => ownerBounds(m, t));
			if (op) ops.push(op);
		}
	}
	if (ops.length === 0) return;
	const command: Command = {
		execute: () => {
			for (const o of ops) store.updateShape(o.id, o.next);
		},
		undo: () => {
			for (const o of ops) store.updateShape(o.id, o.prev);
		},
	};
	commands.execute(command);
}
