// Team-area operations: pure helpers (ownership lookup, island flood, label
// anchors) + store-mutating commands (create team, assign/erase ownership,
// assign an island). Ownership lives in the synced `team-map` shape.
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { type Cells, cellKey, parseCellKey, worldToCell } from "../autotile.js";
import { isTileMap, type TileMapShapeData } from "../tilemap-shape.js";
import {
	isTeamMap,
	makeTeamMap,
	type OwnerMap,
	ownerBounds,
	type TeamInfo,
	type TeamMapShapeData,
} from "./team-map-shape.js";

const MAX_ISLAND_CELLS = 100_000; // safety bound for the flood

export interface TeamDeps {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}

// ── Pure ─────────────────────────────────────────────────────────────────────

/** Team id owning the cell at a world point, or null. */
export function teamIdAtWorld(owner: OwnerMap, x: number, y: number, tile: number): string | null {
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

/** Shallow equality of two ownership maps (same keys + team ids). */
export function ownersEqual(a: OwnerMap, b: OwnerMap): boolean {
	const ak = Object.keys(a);
	if (ak.length !== Object.keys(b).length) return false;
	for (const k of ak) if (a[k] !== b[k]) return false;
	return true;
}

export interface TeamRegionAnchor {
	teamId: string;
	name: string;
	color: string;
	/** Label anchor in world coords (centre of the team's owned-cell bbox). */
	x: number;
	y: number;
	count: number;
}

/** One label anchor per team that owns at least one cell. */
export function teamRegionAnchors(
	owner: OwnerMap,
	teams: Record<string, TeamInfo>,
	tile: number,
): TeamRegionAnchor[] {
	const acc = new Map<
		string,
		{ minC: number; minR: number; maxC: number; maxR: number; n: number }
	>();
	for (const [key, teamId] of Object.entries(owner)) {
		const [c, r] = parseCellKey(key);
		const a = acc.get(teamId);
		if (!a) acc.set(teamId, { minC: c, minR: r, maxC: c, maxR: r, n: 1 });
		else {
			a.minC = Math.min(a.minC, c);
			a.minR = Math.min(a.minR, r);
			a.maxC = Math.max(a.maxC, c);
			a.maxR = Math.max(a.maxR, r);
			a.n++;
		}
	}
	const out: TeamRegionAnchor[] = [];
	for (const [teamId, a] of acc) {
		const info = teams[teamId];
		if (!info) continue;
		out.push({
			teamId,
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

/** The single shared team-map, creating it (live) if none exists yet. */
export function resolveTeamMap(store: BoardStore, tile: number): { id: string; created: boolean } {
	for (const [, s] of store.getShapes()) {
		if (isTeamMap(s)) return { id: s.id, created: false };
	}
	const tm = makeTeamMap(tile);
	store.addShape(tm);
	return { id: tm.id, created: true };
}

export function getTeamMap(store: BoardStore): TeamMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isTeamMap(s)) return s;
	return undefined;
}

function findTilemap(store: BoardStore): TileMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isTileMap(s)) return s;
	return undefined;
}

/** Create a new team (name + color); returns its id. Undoable. */
export function createTeam(deps: TeamDeps, name: string, color: string): string {
	const { id } = resolveTeamMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as TeamMapShapeData | undefined;
	const teamId = generateId();
	const prevTeams = { ...(shape?.teams ?? {}) };
	const nextTeams = { ...prevTeams, [teamId]: { name, color } };
	const command: Command = {
		execute: () => deps.store.updateShape(id, { teams: nextTeams } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { teams: prevTeams } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
	return teamId;
}

/** Live owner snapshot (copy) of the team-map. */
export function currentOwner(store: BoardStore, id: string): OwnerMap {
	const s = store.getShape(id) as TeamMapShapeData | undefined;
	return s ? { ...s.owner } : {};
}

/** Live update (non-undoable) used during a paint stroke. */
export function applyOwner(store: BoardStore, id: string, owner: OwnerMap, tile: number): void {
	store.updateShape(id, { owner, ...ownerBounds(owner, tile) } as Partial<ShapeData>);
}

/** Commit an owner change as one undoable command (undo restores `prevOwner`). */
export function commitOwner(deps: TeamDeps, id: string, prevOwner: OwnerMap): void {
	const shape = deps.store.getShape(id) as TeamMapShapeData | undefined;
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
 * Assign the connected land region (island) under a world point to a team, as
 * one undoable command. No-op if there's no tilemap or the point isn't land.
 */
export function assignIsland(deps: TeamDeps, x: number, y: number, teamId: string): void {
	const tilemap = findTilemap(deps.store);
	if (!tilemap) return;
	const [c, r] = worldToCell(x, y, tilemap.tile ?? deps.tile);
	const keys = landRegionFrom(tilemap.cells, c, r);
	if (keys.length === 0) return;
	const { id } = resolveTeamMap(deps.store, deps.tile);
	const prev = currentOwner(deps.store, id);
	const next: OwnerMap = { ...prev };
	for (const k of keys) next[k] = teamId;
	const prevB = ownerBounds(prev, deps.tile);
	const nextB = ownerBounds(next, deps.tile);
	const command: Command = {
		execute: () => deps.store.updateShape(id, { owner: next, ...nextB } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { owner: prev, ...prevB } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}
