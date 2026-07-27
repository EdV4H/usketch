// The `map` tool: brush / eraser / fill terrain cells, and stamp icons.
// Terrain edits mutate the (single) tilemap shape live during a stroke, then
// commit the whole stroke as ONE undoable command on pointer-up. Stamping adds
// a map-icon via createAddShapeCommand. The palette switches the active submode.
import type {
	CanvasPointerEvent,
	Command,
	ShapeData,
	ToolContext,
	ToolDefinition,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import {
	type CellBox,
	type Cells,
	cellKey,
	cellsBounds,
	floodFill,
	worldToCell,
} from "./autotile.js";
import { ICONS_BY_KEY } from "./icons.js";
import { makeMapIcon } from "./map-icon-shape.js";
import { DEFAULT_TILE, isTileMap, makeTileMap, type TileMapShapeData } from "./tilemap-shape.js";
import { toolStateStore } from "./tool-state.js";

function MapToolIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
			<path
				d="M3 5 L8 3 L12 5 L17 3 V15 L12 17 L8 15 L3 17 Z"
				fill="#a9d888"
				stroke="#141414"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
			<path d="M8 3 V15 M12 5 V17" stroke="#141414" strokeWidth="1.1" />
		</svg>
	);
}

function cellsEqual(a: Cells, b: Cells): boolean {
	const ak = Object.keys(a);
	if (ak.length !== Object.keys(b).length) return false;
	for (const k of ak) if (a[k] !== b[k]) return false;
	return true;
}

export function createMapToolDefinition(tile: number = DEFAULT_TILE): ToolDefinition {
	interface Stroke {
		tilemapId: string;
		created: boolean;
		prevCells: Cells;
	}
	let stroke: Stroke | null = null;
	let lastKey = "";

	/** The single shared tilemap, creating it (live) if none exists yet. */
	function resolveTilemap(ctx: ToolContext): { id: string; created: boolean } {
		for (const [, s] of ctx.store.getShapes()) {
			if (isTileMap(s)) return { id: s.id, created: false };
		}
		const tm = makeTileMap(tile);
		ctx.store.addShape(tm);
		return { id: tm.id, created: true };
	}

	function currentCells(ctx: ToolContext, id: string): Cells {
		const s = ctx.store.getShape(id) as TileMapShapeData | undefined;
		return s ? { ...s.cells } : {};
	}

	function applyCells(ctx: ToolContext, id: string, cells: Cells): void {
		// `cells` is an intrinsic field of TileMapShapeData, outside the base
		// ShapeData type — cast at the store boundary (as freedraw does for points).
		ctx.store.updateShape(id, { cells, ...cellsBounds(cells, tile) } as Partial<ShapeData>);
	}

	function paintAt(ctx: ToolContext, event: CanvasPointerEvent): void {
		if (!stroke) return;
		const [c, r] = worldToCell(event.worldPoint.x, event.worldPoint.y, tile);
		const key = cellKey(c, r);
		if (key === lastKey) return;
		lastKey = key;
		const { mode, terrain } = toolStateStore.get();
		const cells = currentCells(ctx, stroke.tilemapId);
		if (mode === "eraser") {
			if (!(key in cells)) return;
			delete cells[key];
		} else {
			if (cells[key] === terrain) return;
			cells[key] = terrain;
		}
		applyCells(ctx, stroke.tilemapId, cells);
	}

	function doFill(ctx: ToolContext, event: CanvasPointerEvent): void {
		if (!stroke) return;
		const [c, r] = worldToCell(event.worldPoint.x, event.worldPoint.y, tile);
		const { terrain } = toolStateStore.get();
		const cells = currentCells(ctx, stroke.tilemapId);
		// Empty-cell fills are bounded to the current painted region so the flood
		// is finite; painted-cell fills are naturally bounded by the region.
		const b = cellsBounds(cells, tile);
		const box: CellBox | undefined =
			Object.keys(cells).length === 0
				? undefined
				: {
						minC: Math.floor(b.x / tile),
						minR: Math.floor(b.y / tile),
						maxC: Math.floor(b.x / tile) + b.width / tile - 1,
						maxR: Math.floor(b.y / tile) + b.height / tile - 1,
					};
		const keys = floodFill(cells, c, r, box);
		if (keys.length === 0) return;
		for (const k of keys) cells[k] = terrain;
		applyCells(ctx, stroke.tilemapId, cells);
	}

	function commit(ctx: ToolContext): void {
		if (!stroke) return;
		const { tilemapId, created, prevCells } = stroke;
		stroke = null;
		lastKey = "";
		const shape = ctx.store.getShape(tilemapId) as TileMapShapeData | undefined;
		const nextCells = shape ? shape.cells : {};

		if (created) {
			// Newly created this stroke: commit as an add (undo deletes it).
			if (!shape || Object.keys(nextCells).length === 0) {
				if (shape) ctx.store.deleteShape(tilemapId);
				return;
			}
			const finalShape = { ...shape } as ShapeData;
			ctx.store.deleteShape(tilemapId);
			ctx.commands.execute(createAddShapeCommand(ctx.store, finalShape));
			return;
		}

		// Edited an existing tilemap: commit the cells diff (undo restores prev).
		if (cellsEqual(prevCells, nextCells)) return;
		const prev = prevCells;
		const next = { ...nextCells };
		const prevBounds = cellsBounds(prev, tile);
		const nextBounds = cellsBounds(next, tile);
		const command: Command = {
			execute: () =>
				ctx.store.updateShape(tilemapId, { cells: next, ...nextBounds } as Partial<ShapeData>),
			undo: () =>
				ctx.store.updateShape(tilemapId, { cells: prev, ...prevBounds } as Partial<ShapeData>),
		};
		ctx.commands.execute(command);
	}

	function placeIcon(ctx: ToolContext, event: CanvasPointerEvent): void {
		const { iconKey } = toolStateStore.get();
		const def = ICONS_BY_KEY.get(iconKey);
		if (!def) return;
		const shape = makeMapIcon(iconKey, def.category, event.worldPoint.x, event.worldPoint.y);
		ctx.commands.execute(createAddShapeCommand(ctx.store, shape));
		ctx.store.setSelection([shape.id]);
	}

	return {
		icon: MapToolIcon,
		cursor: "crosshair",
		shortcut: "m",
		order: 45,
		onPointerDown(ctx, event) {
			const { mode } = toolStateStore.get();
			if (mode === "stamp") {
				placeIcon(ctx, event);
				return;
			}
			const target = resolveTilemap(ctx);
			stroke = {
				tilemapId: target.id,
				created: target.created,
				prevCells: currentCells(ctx, target.id),
			};
			lastKey = "";
			if (mode === "fill") doFill(ctx, event);
			else paintAt(ctx, event);
		},
		onPointerMove(ctx, event) {
			if (!stroke) return;
			const { mode } = toolStateStore.get();
			if (mode === "brush" || mode === "eraser") paintAt(ctx, event);
		},
		onPointerUp(ctx) {
			commit(ctx);
			// Keep the map tool active for continuous painting/stamping.
		},
		onDeactivate() {
			// Abort an in-flight stroke without committing a partial undo entry.
			stroke = null;
			lastKey = "";
		},
	};
}
