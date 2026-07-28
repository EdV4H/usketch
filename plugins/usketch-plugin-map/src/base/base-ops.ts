// Base-area operations: pure helpers (ownership lookup, island flood, label
// anchors) + store-mutating commands (create base, assign/erase ownership,
// assign an island). Ownership lives in the synced `base-map` shape.
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { type Cells, cellKey, parseCellKey, worldToCell } from "../autotile.js";
import { isTileMap, type TileMapShapeData } from "../tilemap-shape.js";
import {
	type BaseInfo,
	type BaseMapShapeData,
	isBaseMap,
	makeBaseMap,
	type OwnerMap,
	ownerBounds,
} from "./base-map-shape.js";

const MAX_ISLAND_CELLS = 100_000; // safety bound for the flood

export interface BaseDeps {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}

// ── Pure ─────────────────────────────────────────────────────────────────────

/** Base id owning the cell at a world point, or null. */
export function baseIdAtWorld(owner: OwnerMap, x: number, y: number, tile: number): string | null {
	const [c, r] = worldToCell(x, y, tile);
	return owner[cellKey(c, r)] ?? null;
}

/**
 * Connected land region (4-neighbour) starting at a cell — all cells reachable
 * without crossing water/empty. `terrainCells` is the tilemap's cells; a cell is
 * land when it exists and isn't "water". Returns the cell keys (empty if the
 * start isn't land).
 */
export function landRegionFrom(terrainCells: Cells, startCol: number, startRow: number): string[] {
	const isLand = (c: number, r: number) => {
		const t = terrainCells[cellKey(c, r)];
		return t !== undefined && t !== "water";
	};
	if (!isLand(startCol, startRow)) return [];
	const out: string[] = [];
	const seen = new Set<string>();
	const stack: [number, number][] = [[startCol, startRow]];
	while (stack.length) {
		// Cap hit → the region is too large to own atomically; abort rather than
		// assign only a truncated part of the landmass.
		if (out.length >= MAX_ISLAND_CELLS) return [];
		const next = stack.pop();
		if (!next) break;
		const [c, r] = next;
		const key = cellKey(c, r);
		if (seen.has(key)) continue;
		if (!isLand(c, r)) continue;
		seen.add(key);
		out.push(key);
		stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
	}
	return out;
}

/** Shallow equality of two ownership maps (same keys + base ids). */
export function ownersEqual(a: OwnerMap, b: OwnerMap): boolean {
	const ak = Object.keys(a);
	if (ak.length !== Object.keys(b).length) return false;
	for (const k of ak) if (a[k] !== b[k]) return false;
	return true;
}

export interface BaseRegionAnchor {
	baseId: string;
	name: string;
	color: string;
	/** Label anchor in world coords (centre of the base's owned-cell bbox). */
	x: number;
	y: number;
	count: number;
}

/** One label anchor per base that owns at least one cell. */
export function baseRegionAnchors(
	owner: OwnerMap,
	bases: Record<string, BaseInfo>,
	tile: number,
): BaseRegionAnchor[] {
	const acc = new Map<
		string,
		{ minC: number; minR: number; maxC: number; maxR: number; n: number }
	>();
	for (const [key, baseId] of Object.entries(owner)) {
		const [c, r] = parseCellKey(key);
		const a = acc.get(baseId);
		if (!a) acc.set(baseId, { minC: c, minR: r, maxC: c, maxR: r, n: 1 });
		else {
			a.minC = Math.min(a.minC, c);
			a.minR = Math.min(a.minR, r);
			a.maxC = Math.max(a.maxC, c);
			a.maxR = Math.max(a.maxR, r);
			a.n++;
		}
	}
	const out: BaseRegionAnchor[] = [];
	for (const [baseId, a] of acc) {
		const info = bases[baseId];
		if (!info) continue;
		out.push({
			baseId,
			name: info.name,
			color: info.color,
			x: ((a.minC + a.maxC + 1) / 2) * tile,
			y: ((a.minR + a.maxR + 1) / 2) * tile,
			count: a.n,
		});
	}
	return out;
}

// ── Store ops ────────────────────────────────────────────────────────────────

/** The single shared base-map, creating it (live) if none exists yet. */
export function resolveBaseMap(store: BoardStore, tile: number): { id: string; created: boolean } {
	for (const [, s] of store.getShapes()) {
		if (isBaseMap(s)) return { id: s.id, created: false };
	}
	const tm = makeBaseMap(tile);
	store.addShape(tm);
	return { id: tm.id, created: true };
}

export function getBaseMap(store: BoardStore): BaseMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isBaseMap(s)) return s;
	return undefined;
}

function findTilemap(store: BoardStore): TileMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isTileMap(s)) return s;
	return undefined;
}

/** Create a new base (name + color); returns its id. Undoable. */
export function createBase(deps: BaseDeps, name: string, color: string): string {
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const baseId = generateId();
	const prevBases = { ...(shape?.bases ?? {}) };
	const nextBases = { ...prevBases, [baseId]: { name, color } };
	const command: Command = {
		execute: () => deps.store.updateShape(id, { bases: nextBases } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { bases: prevBases } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
	return baseId;
}

/** Live owner snapshot (copy) of the base-map. */
export function currentOwner(store: BoardStore, id: string): OwnerMap {
	const s = store.getShape(id) as BaseMapShapeData | undefined;
	return s ? { ...s.owner } : {};
}

/** Live update (non-undoable) used during a paint stroke. */
export function applyOwner(store: BoardStore, id: string, owner: OwnerMap, tile: number): void {
	store.updateShape(id, { owner, ...ownerBounds(owner, tile) } as Partial<ShapeData>);
}

/** Commit an owner change as one undoable command (undo restores `prevOwner`). */
export function commitOwner(deps: BaseDeps, id: string, prevOwner: OwnerMap): void {
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const nextOwner = { ...(shape?.owner ?? {}) };
	if (ownersEqual(prevOwner, nextOwner)) return; // no change → no undo entry
	const prev = prevOwner;
	const prevB = ownerBounds(prev, deps.tile);
	const nextB = ownerBounds(nextOwner, deps.tile);
	const command: Command = {
		execute: () => deps.store.updateShape(id, { owner: nextOwner, ...nextB } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { owner: prev, ...prevB } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}

/**
 * Assign the connected land region (island) under a world point to a base, as
 * one undoable command. No-op if there's no tilemap or the point isn't land.
 */
export function assignIsland(deps: BaseDeps, x: number, y: number, baseId: string): void {
	const tilemap = findTilemap(deps.store);
	if (!tilemap) return;
	const [c, r] = worldToCell(x, y, tilemap.tile ?? deps.tile);
	const keys = landRegionFrom(tilemap.cells, c, r);
	if (keys.length === 0) return;
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const prev = currentOwner(deps.store, id);
	const next: OwnerMap = { ...prev };
	for (const k of keys) next[k] = baseId;
	const prevB = ownerBounds(prev, deps.tile);
	const nextB = ownerBounds(next, deps.tile);
	const command: Command = {
		execute: () => deps.store.updateShape(id, { owner: next, ...nextB } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { owner: prev, ...prevB } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}
