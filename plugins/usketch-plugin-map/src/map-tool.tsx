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
import {
	createAddShapeCommand,
	createDeleteWithChildrenCommand,
	isEffectivelyHidden,
	isEffectivelyLocked,
} from "@edv4h/usketch-store";
import {
	type CellBox,
	type Cells,
	cellKey,
	cellsBounds,
	floodFill,
	regionFillCells,
	worldToCell,
} from "./autotile.js";
import { createBase, getBaseMap, setBeacon } from "./base/base-ops.js";
import { baseStateStore } from "./base/base-state.js";
import { genStateStore } from "./gen-state.js";
import { generateIntoBox, resolveTilemap } from "./generate.js";
import { ICONS_BY_KEY } from "./icons.js";
import { MAP_ICON_TYPE, makeMapIcon } from "./map-icon-shape.js";
import { DEFAULT_TILE, type TileMapShapeData } from "./tilemap-shape.js";
import { toolStateStore } from "./tool-state.js";

// Default colours cycled through when a base is auto-created on first beacon.
const BASE_PALETTE = [
	"#EF5350",
	"#4A7FB8",
	"#6C5CD6",
	"#2AA1A8",
	"#F6C124",
	"#25A05B",
	"#F48CB4",
	"#F0913E",
];

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
		prevHandPaint: Record<string, true>;
	}
	let stroke: Stroke | null = null;
	let lastKey = "";
	// Range-select drag for the "generate" submode (world start point).
	let genDrag: { x0: number; y0: number } | null = null;

	function currentCells(ctx: ToolContext, id: string): Cells {
		const s = ctx.store.getShape(id) as TileMapShapeData | undefined;
		return s ? { ...s.cells } : {};
	}

	function currentHandPaint(ctx: ToolContext, id: string): Record<string, true> {
		const s = ctx.store.getShape(id) as TileMapShapeData | undefined;
		return s?.handPaint ? { ...s.handPaint } : {};
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

	/**
	 * Region fill: like `doFill` (flood the connected same-terrain area from the
	 * click into the selected terrain) but honours the `excludeTerrains` set —
	 * cells of a protected terrain are never overwritten, and clicking a protected
	 * terrain does nothing.
	 */
	function doRegionFill(ctx: ToolContext, event: CanvasPointerEvent): void {
		if (!stroke) return;
		const [c, r] = worldToCell(event.worldPoint.x, event.worldPoint.y, tile);
		const { terrain, excludeTerrains } = toolStateStore.get();
		const exclude = new Set(excludeTerrains);
		const cells = currentCells(ctx, stroke.tilemapId);
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
		let changed = false;
		for (const k of regionFillCells(cells, c, r, exclude, box)) {
			if (cells[k] === terrain) continue;
			cells[k] = terrain;
			changed = true;
		}
		if (!changed) return;
		applyCells(ctx, stroke.tilemapId, cells);
	}

	function commit(ctx: ToolContext): void {
		if (!stroke) return;
		const { tilemapId, created, prevCells, prevHandPaint } = stroke;
		stroke = null;
		lastKey = "";
		const shape = ctx.store.getShape(tilemapId) as TileMapShapeData | undefined;
		const nextCells = shape ? shape.cells : {};

		if (created) {
			// Newly created this stroke: commit as an add (undo deletes it). Every
			// cell was just hand-painted, so mark them all as hand-paint.
			if (!shape || Object.keys(nextCells).length === 0) {
				if (shape) ctx.store.deleteShape(tilemapId);
				return;
			}
			const handPaint: Record<string, true> = {};
			for (const k of Object.keys(nextCells)) handPaint[k] = true;
			const finalShape = { ...shape, handPaint } as ShapeData;
			ctx.store.deleteShape(tilemapId);
			ctx.commands.execute(createAddShapeCommand(ctx.store, finalShape));
			return;
		}

		// Edited an existing tilemap: commit the cells diff (undo restores prev).
		if (cellsEqual(prevCells, nextCells)) return;
		const prev = prevCells;
		const next = { ...nextCells };
		// Hand-paint set = previous ∪ cells set this stroke − cells erased this stroke.
		// (Only cells the user actually touched change; generated cells are untouched.)
		const nextHandPaint = { ...prevHandPaint };
		for (const k of new Set([...Object.keys(prev), ...Object.keys(next)])) {
			if (prev[k] === next[k]) continue; // unchanged this stroke
			if (k in next) nextHandPaint[k] = true;
			else delete nextHandPaint[k];
		}
		const prevBounds = cellsBounds(prev, tile);
		const nextBounds = cellsBounds(next, tile);
		const command: Command = {
			execute: () =>
				ctx.store.updateShape(tilemapId, {
					cells: next,
					handPaint: nextHandPaint,
					...nextBounds,
				} as Partial<ShapeData>),
			undo: () =>
				ctx.store.updateShape(tilemapId, {
					cells: prev,
					handPaint: prevHandPaint,
					...prevBounds,
				} as Partial<ShapeData>),
		};
		ctx.commands.execute(command);
	}

	/**
	 * Topmost interactable map-icon under the point (frontmost wins), or null.
	 * Uses the shape's registered (rotation-aware) hitTest and skips shapes that
	 * are effectively locked/hidden, matching normal canvas interaction rules.
	 */
	function findMapIconAt(ctx: ToolContext, x: number, y: number): string | null {
		const def = ctx.shapes.get(MAP_ICON_TYPE);
		if (!def) return null;
		const point = { x, y };
		let found: string | null = null;
		for (const s of ctx.store.getShapesSorted()) {
			if (s.type !== MAP_ICON_TYPE) continue;
			if (isEffectivelyLocked(ctx.store, s) || isEffectivelyHidden(ctx.store, s)) continue;
			if (def.hitTest(s, point)) found = s.id;
		}
		return found;
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
			if (mode === "generate") {
				genDrag = { x0: event.worldPoint.x, y0: event.worldPoint.y };
				genStateStore.set({
					pendingRect: { x: event.worldPoint.x, y: event.worldPoint.y, w: 0, h: 0 },
				});
				return;
			}
			if (mode === "base") {
				// Base mode: click a map-icon to make it the active base's beacon.
				// The territory is derived from beacon + terrain (see territory.ts).
				const iconId = findMapIconAt(ctx, event.worldPoint.x, event.worldPoint.y);
				if (!iconId) return; // only meaningful when clicking on an icon
				const deps = { store: ctx.store, commands: ctx.commands, tile };
				let baseId = baseStateStore.get().activeBaseId;
				// Auto-create a base on first use so a single click "just works".
				if (!baseId || !getBaseMap(ctx.store)?.bases[baseId]) {
					const n = Object.keys(getBaseMap(ctx.store)?.bases ?? {}).length;
					baseId = createBase(deps, `拠点${n + 1}`, BASE_PALETTE[n % BASE_PALETTE.length]);
					baseStateStore.set({ activeBaseId: baseId });
				}
				setBeacon(deps, iconId, baseId);
				return;
			}
			// Eraser: clicking a placed icon removes it (icons aren't terrain cells).
			if (mode === "eraser") {
				const iconId = findMapIconAt(ctx, event.worldPoint.x, event.worldPoint.y);
				if (iconId) {
					ctx.commands.execute(createDeleteWithChildrenCommand(ctx.store, iconId));
					return;
				}
			}
			const target = resolveTilemap(ctx.store, tile);
			stroke = {
				tilemapId: target.id,
				created: target.created,
				prevCells: currentCells(ctx, target.id),
				prevHandPaint: currentHandPaint(ctx, target.id),
			};
			lastKey = "";
			if (mode === "fill") doFill(ctx, event);
			else if (mode === "region") doRegionFill(ctx, event);
			else paintAt(ctx, event);
		},
		onPointerMove(ctx, event) {
			if (genDrag) {
				const x = Math.min(genDrag.x0, event.worldPoint.x);
				const y = Math.min(genDrag.y0, event.worldPoint.y);
				const w = Math.abs(event.worldPoint.x - genDrag.x0);
				const h = Math.abs(event.worldPoint.y - genDrag.y0);
				genStateStore.set({ pendingRect: { x, y, w, h } });
				return;
			}
			if (!stroke) return;
			const { mode } = toolStateStore.get();
			if (mode === "brush" || mode === "eraser") paintAt(ctx, event);
		},
		onPointerUp(ctx) {
			if (genDrag) {
				const rect = genStateStore.get().pendingRect;
				genDrag = null;
				genStateStore.set({ pendingRect: null });
				if (rect && rect.w >= tile / 2 && rect.h >= tile / 2) {
					// Cells the preview rectangle actually covers (right/bottom edges
					// exclusive so a boundary-aligned drag doesn't grab an extra cell).
					const box: CellBox = {
						minC: Math.floor(rect.x / tile),
						minR: Math.floor(rect.y / tile),
						maxC: Math.ceil((rect.x + rect.w) / tile) - 1,
						maxR: Math.ceil((rect.y + rect.h) / tile) - 1,
					};
					const gs = genStateStore.get();
					generateIntoBox(
						{ store: ctx.store, commands: ctx.commands, tile },
						{ generatorId: gs.algorithmId, seed: gs.seed, params: gs.params, box },
					);
				}
				return;
			}
			commit(ctx);
			// Keep the map tool active for continuous painting/stamping.
		},
		onDeactivate(ctx) {
			if (genDrag) {
				genDrag = null;
				genStateStore.set({ pendingRect: null });
			}
			// Tool switched / left mid-stroke with no pointerUp: don't leave a
			// half-painted, non-undoable state. Roll the live edits back to where
			// the stroke started (delete a tilemap created this stroke; restore the
			// previous cells of an edited one), then clear.
			if (stroke) {
				const { tilemapId, created, prevCells } = stroke;
				if (created) {
					ctx.store.deleteShape(tilemapId);
				} else {
					ctx.store.updateShape(tilemapId, {
						cells: prevCells,
						...cellsBounds(prevCells, tile),
					} as Partial<ShapeData>);
				}
				stroke = null;
				lastKey = "";
			}
		},
	};
}
