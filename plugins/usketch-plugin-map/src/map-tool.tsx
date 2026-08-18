// The `map` tool: brush / eraser / fill terrain cells, and place base beacons.
// Terrain edits write GRID DATA on the (single) tilemap shape's `cells`, mutating
// the shape live during a stroke, then committing the whole stroke as ONE undoable
// command on pointer-up. The eraser also clears any LEGACY grid icon on a cell
// before its terrain (see paintAt) — stamping is gone, but old boards may still
// carry `icons` data. Base mode drops a base at the clicked cell (its landmark
// icon is derived from the base — see base-icon-layer.tsx). The palette switches
// the active submode.
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
	type IconCells,
	regionFillCells,
	samplerFloodFill,
	worldToCell,
} from "./autotile.js";
import { createBase, getBaseMap, setBeacon } from "./base/base-ops.js";
import { baseStateStore } from "./base/base-state.js";
import { makeTerrainSampler, resolveBaseGen } from "./base-terrain.js";
import { genStateStore } from "./gen-state.js";
import { generateIntoBox, resolveTilemap } from "./generate.js";
import type { TerrainKey } from "./terrain.js";
import {
	DEFAULT_TILE,
	isTileMap,
	seededTilemap,
	type TileMapShapeData,
	tilemapBounds,
} from "./tilemap-shape.js";
import { toolStateStore } from "./tool-state.js";

// Hard cap on a single sampler-based fill over the infinite base terrain. A truly
// enclosed region terminates well below this; hitting it means the region is open
// (e.g. an infinite ocean), so the fill is aborted rather than painting a blob.
const MAX_FILL_CELLS = 8192;

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

function iconsEqual(a: IconCells, b: IconCells): boolean {
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
		prevIcons: IconCells;
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

	function currentIcons(ctx: ToolContext, id: string): IconCells {
		const s = ctx.store.getShape(id) as TileMapShapeData | undefined;
		return s?.icons ? { ...s.icons } : {};
	}

	// Write terrain cells; bounds enclose the shape's existing icons too so an
	// icon-only cell outside the paint doesn't get clipped. (`cells`/`icons` are
	// intrinsic tilemap fields outside base ShapeData — cast at the store boundary.)
	function applyCells(ctx: ToolContext, id: string, cells: Cells): void {
		const icons = (ctx.store.getShape(id) as TileMapShapeData | undefined)?.icons;
		ctx.store.updateShape(id, {
			cells,
			...tilemapBounds(cells, icons, tile),
		} as Partial<ShapeData>);
	}

	// Write both grids at once (used by the eraser, which may remove either).
	function applyGrid(ctx: ToolContext, id: string, cells: Cells, icons: IconCells): void {
		ctx.store.updateShape(id, {
			cells,
			icons,
			...tilemapBounds(cells, icons, tile),
		} as Partial<ShapeData>);
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
			// Erase the icon first (it sits on top); only if there's none, the terrain.
			const icons = currentIcons(ctx, stroke.tilemapId);
			if (key in icons) {
				delete icons[key];
				applyGrid(ctx, stroke.tilemapId, cells, icons);
				return;
			}
			if (!(key in cells)) return;
			delete cells[key];
		} else {
			if (cells[key] === terrain) return;
			cells[key] = terrain;
		}
		applyCells(ctx, stroke.tilemapId, cells);
	}

	/** The board's infinite-base config (seed + frozen gen), or null when off. */
	function baseConfig(
		ctx: ToolContext,
	): { seed: number; gen: ReturnType<typeof resolveBaseGen> } | null {
		const tm = seededTilemap(ctx.store.getShapes().values());
		return tm?.baseSeed != null ? { seed: tm.baseSeed, gen: resolveBaseGen(tm.baseGen) } : null;
	}

	/**
	 * Painted overrides as the RENDERER sees them: every tilemap's cells merged in
	 * id order (highest id wins), matching `map-layer`. The fill sampler must read
	 * this — not just the stroke tilemap — so the flooded region agrees with the
	 * terrain the user actually clicked when several tilemaps coexist.
	 */
	function mergedOverrides(ctx: ToolContext): Cells {
		const tms = [...ctx.store.getShapes().values()].filter(isTileMap);
		if (tms.length <= 1) return tms[0] ? { ...tms[0].cells } : {};
		return Object.assign(
			{},
			...[...tms].sort((a, b) => (a.id < b.id ? -1 : 1)).map((tm) => tm.cells),
		);
	}

	/**
	 * Region isn't enclosed (open terrain, e.g. infinite ocean) — don't paint an
	 * arbitrary capped blob. Emit an event so a HUD can surface a message (no toast
	 * yet), and no-op the fill. Intentionally no console output: an aborted open
	 * fill is an expected user outcome, not a warning.
	 */
	function abortFill(ctx: ToolContext, scanned: number): void {
		ctx.events.emit("map:fill-aborted", { reason: "not-enclosed", scanned });
	}

	/** Painted-cell bounds as a flood box, or undefined for an empty tilemap. */
	function paintedBox(cells: Cells): CellBox | undefined {
		if (Object.keys(cells).length === 0) return undefined;
		const b = cellsBounds(cells, tile);
		return {
			minC: Math.floor(b.x / tile),
			minR: Math.floor(b.y / tile),
			maxC: Math.floor(b.x / tile) + b.width / tile - 1,
			maxR: Math.floor(b.y / tile) + b.height / tile - 1,
		};
	}

	/** Write `terrain` into every region key that differs; returns whether anything changed. */
	function paintRegion(cells: Cells, keys: string[], terrain: TerrainKey): boolean {
		let changed = false;
		for (const k of keys) {
			if (cells[k] === terrain) continue;
			cells[k] = terrain;
			changed = true;
		}
		return changed;
	}

	function doFill(ctx: ToolContext, event: CanvasPointerEvent): void {
		if (!stroke) return;
		const [c, r] = worldToCell(event.worldPoint.x, event.worldPoint.y, tile);
		const { terrain } = toolStateStore.get();
		const cells = currentCells(ctx, stroke.tilemapId);

		const base = baseConfig(ctx);
		if (base) {
			// Infinite base: flood over the SAMPLED terrain (merged overrides ?? base)
			// so the click's visible terrain is honoured, capped + aborted when not
			// enclosed. Read the merged view (all tilemaps) but write to the stroke one.
			const sample = makeTerrainSampler(mergedOverrides(ctx), base.seed, null, base.gen);
			const res = samplerFloodFill(sample, c, r, MAX_FILL_CELLS);
			if (res.truncated) {
				abortFill(ctx, res.cells.length);
				return;
			}
			if (!paintRegion(cells, res.cells, terrain)) return;
			applyCells(ctx, stroke.tilemapId, cells);
			return;
		}

		// Finite board: empty-cell fills are bounded to the current painted region
		// so the flood is finite; painted-cell fills are naturally bounded.
		const keys = floodFill(cells, c, r, paintedBox(cells));
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

		const base = baseConfig(ctx);
		if (base) {
			const sample = makeTerrainSampler(mergedOverrides(ctx), base.seed, null, base.gen);
			const start = sample(c, r);
			// Clicking a protected (or empty) terrain is a no-op; since the flood only
			// spreads across `start`, it can never reach a protected cell.
			if (start === undefined || exclude.has(start)) return;
			const res = samplerFloodFill(sample, c, r, MAX_FILL_CELLS);
			if (res.truncated) {
				abortFill(ctx, res.cells.length);
				return;
			}
			if (!paintRegion(cells, res.cells, terrain)) return;
			applyCells(ctx, stroke.tilemapId, cells);
			return;
		}

		if (!paintRegion(cells, regionFillCells(cells, c, r, exclude, paintedBox(cells)), terrain))
			return;
		applyCells(ctx, stroke.tilemapId, cells);
	}

	function commit(ctx: ToolContext): void {
		if (!stroke) return;
		const { tilemapId, created, prevCells, prevHandPaint, prevIcons } = stroke;
		stroke = null;
		lastKey = "";
		const shape = ctx.store.getShape(tilemapId) as TileMapShapeData | undefined;
		const nextCells = shape ? shape.cells : {};
		const nextIcons: IconCells = shape?.icons ? { ...shape.icons } : {};

		if (created) {
			// Newly created this stroke: commit as an add (undo deletes it). Every
			// cell was just hand-painted, so mark them all as hand-paint.
			if (!shape || (Object.keys(nextCells).length === 0 && Object.keys(nextIcons).length === 0)) {
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

		// Edited an existing tilemap: commit the cells + icons diff (undo restores prev).
		if (cellsEqual(prevCells, nextCells) && iconsEqual(prevIcons, nextIcons)) return;
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
		const prevBounds = tilemapBounds(prev, prevIcons, tile);
		const nextBounds = tilemapBounds(next, nextIcons, tile);
		const command: Command = {
			execute: () =>
				ctx.store.updateShape(tilemapId, {
					cells: next,
					icons: nextIcons,
					handPaint: nextHandPaint,
					...nextBounds,
				} as Partial<ShapeData>),
			undo: () =>
				ctx.store.updateShape(tilemapId, {
					cells: prev,
					icons: prevIcons,
					handPaint: prevHandPaint,
					...prevBounds,
				} as Partial<ShapeData>),
		};
		ctx.commands.execute(command);
	}

	/** True when the cell's EFFECTIVE terrain (painted ?? generated) is in the
	 *  base-tool exclude set — a base must not anchor there (e.g. on sea). */
	function isExcludedCell(ctx: ToolContext, c: number, r: number): boolean {
		const exclude = new Set(baseStateStore.get().excludeTerrains);
		if (exclude.size === 0) return false;
		const tm = seededTilemap(ctx.store.getShapes().values());
		const sampler = makeTerrainSampler(
			mergedOverrides(ctx),
			tm?.baseSeed ?? null,
			null,
			resolveBaseGen(tm?.baseGen),
		);
		const terr = sampler(c, r);
		return terr !== undefined && exclude.has(terr);
	}

	return {
		icon: MapToolIcon,
		cursor: "crosshair",
		shortcut: "m",
		order: 45,
		onPointerDown(ctx, event) {
			const { mode } = toolStateStore.get();
			if (mode === "generate") {
				genDrag = { x0: event.worldPoint.x, y0: event.worldPoint.y };
				genStateStore.set({
					pendingRect: { x: event.worldPoint.x, y: event.worldPoint.y, w: 0, h: 0 },
				});
				return;
			}
			if (mode === "base") {
				// Base mode: click a CELL to drop the active base there (its beacon).
				// The base IS the landmark — its icon is derived from the base (radius
				// tier / override) and drawn by the BaseIconLayer, so no pre-placed icon
				// is needed. Territory is derived from the beacon cell + terrain
				// (territory.ts). Only excluded terrain (e.g. sea) is off-limits.
				const [c, r] = worldToCell(event.worldPoint.x, event.worldPoint.y, tile);
				if (isExcludedCell(ctx, c, r)) return; // no base on sea / excluded terrain
				const key = cellKey(c, r);
				const deps = { store: ctx.store, commands: ctx.commands, tile };
				let baseId = baseStateStore.get().activeBaseId;
				// Auto-create a base on first use so a single click "just works".
				if (!baseId || !getBaseMap(ctx.store)?.bases[baseId]) {
					const n = Object.keys(getBaseMap(ctx.store)?.bases ?? {}).length;
					baseId = createBase(deps, `拠点${n + 1}`, BASE_PALETTE[n % BASE_PALETTE.length]);
					baseStateStore.set({ activeBaseId: baseId });
				}
				setBeacon(deps, key, baseId);
				return;
			}
			// brush / eraser / fill / region all edit the tilemap grid via a stroke.
			const target = resolveTilemap(ctx.store, tile);
			stroke = {
				tilemapId: target.id,
				created: target.created,
				prevCells: currentCells(ctx, target.id),
				prevHandPaint: currentHandPaint(ctx, target.id),
				prevIcons: currentIcons(ctx, target.id),
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
				const { tilemapId, created, prevCells, prevIcons } = stroke;
				if (created) {
					ctx.store.deleteShape(tilemapId);
				} else {
					ctx.store.updateShape(tilemapId, {
						cells: prevCells,
						icons: prevIcons,
						...tilemapBounds(prevCells, prevIcons, tile),
					} as Partial<ShapeData>);
				}
				stroke = null;
				lastKey = "";
			}
		},
	};
}
