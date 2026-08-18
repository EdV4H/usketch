// Base registry operations: pure helpers (territory lookup, label anchors) +
// store-mutating commands (create a base, set a base's beacon). Territory itself
// is DERIVED (see territory.ts) — nothing here writes per-cell ownership.
import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { type Cells, cellKey, exposedEdges, parseCellKey, worldToCell } from "../autotile.js";
import {
	type BaseInfo,
	type BaseMapShapeData,
	DEFAULT_BASE_RADIUS,
	isBaseMap,
	makeBaseMap,
} from "./base-map-shape.js";
import type { Territory } from "./territory.js";

export interface BaseDeps {
	store: BoardStore;
	commands: CommandRegistry;
	tile: number;
}

// ── Pure ─────────────────────────────────────────────────────────────────────

/** Base id owning the cell at a world point, or null. */
export function baseIdAtWorld(
	territory: Territory,
	x: number,
	y: number,
	tile: number,
): string | null {
	const [c, r] = worldToCell(x, y, tile);
	return territory[cellKey(c, r)] ?? null;
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
	territory: Territory,
	bases: Record<string, BaseInfo>,
	tile: number,
): BaseRegionAnchor[] {
	const acc = new Map<
		string,
		{ minC: number; minR: number; maxC: number; maxR: number; n: number }
	>();
	for (const [key, baseId] of Object.entries(territory)) {
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

/** A whole base region + the geometry a host needs to draw it (for the
 *  `territory.region.render` hook). Superset of BaseRegionAnchor. */
export interface TerritoryRegion {
	baseId: string;
	name: string;
	color: string;
	/** Owned cell keys (`"c,r"`). */
	cells: string[];
	tile: number;
	/** World bbox enclosing the owned cells. */
	bounds: { x: number; y: number; width: number; height: number };
	/** Region centre in world coords (same point as BaseRegionAnchor). */
	anchor: { x: number; y: number };
	count: number;
	/** Beacon cell + radius, for drawing the radius ring (beacon may be unset). */
	beaconCell?: string;
	radius: number;
	/** SVG path (world coords) tracing the region's EXPOSED border edges — a
	 *  neighbour not owned by the same base. Handy for a custom border stroke;
	 *  empty when the region has no cells. */
	outline: string;
}

/**
 * Group the derived territory into one region per base, carrying the full geometry
 * (cells, bbox, centre, beacon ring, exposed-edge path) a host needs to draw it.
 * Like baseRegionAnchors, but the whole region — powers `territory.region.render`.
 */
export function baseRegions(
	territory: Territory,
	bases: Record<string, BaseInfo>,
	tile: number,
): TerritoryRegion[] {
	const acc = new Map<
		string,
		{ cells: string[]; minC: number; minR: number; maxC: number; maxR: number }
	>();
	for (const [key, baseId] of Object.entries(territory)) {
		const [c, r] = parseCellKey(key);
		const a = acc.get(baseId);
		if (!a) acc.set(baseId, { cells: [key], minC: c, minR: r, maxC: c, maxR: r });
		else {
			a.cells.push(key);
			a.minC = Math.min(a.minC, c);
			a.minR = Math.min(a.minR, r);
			a.maxC = Math.max(a.maxC, c);
			a.maxR = Math.max(a.maxR, r);
		}
	}
	const asCells = territory as unknown as Cells; // exposedEdges only compares values
	const out: TerritoryRegion[] = [];
	for (const [baseId, a] of acc) {
		const info = bases[baseId];
		if (!info) continue;
		// Exposed-edge path: a segment per owned-cell side whose neighbour isn't this
		// same base (so region-vs-region and region-vs-empty both count as a border).
		let outline = "";
		for (const key of a.cells) {
			const [c, r] = parseCellKey(key);
			const x = c * tile;
			const y = r * tile;
			const e = exposedEdges(asCells, c, r);
			if (e.n) outline += `M${x} ${y}L${x + tile} ${y}`;
			if (e.s) outline += `M${x} ${y + tile}L${x + tile} ${y + tile}`;
			if (e.w) outline += `M${x} ${y}L${x} ${y + tile}`;
			if (e.e) outline += `M${x + tile} ${y}L${x + tile} ${y + tile}`;
		}
		out.push({
			baseId,
			name: info.name,
			color: info.color,
			cells: a.cells,
			tile,
			bounds: {
				x: a.minC * tile,
				y: a.minR * tile,
				width: (a.maxC - a.minC + 1) * tile,
				height: (a.maxR - a.minR + 1) * tile,
			},
			anchor: { x: ((a.minC + a.maxC + 1) / 2) * tile, y: ((a.minR + a.maxR + 1) / 2) * tile },
			count: a.cells.length,
			beaconCell: info.beaconCell,
			radius: info.radius,
			outline,
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
	const bm = makeBaseMap(tile);
	store.addShape(bm);
	return { id: bm.id, created: true };
}

export function getBaseMap(store: BoardStore): BaseMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isBaseMap(s)) return s;
	return undefined;
}

/** Create a new base (name + colour, default radius); returns its id. Undoable. */
export function createBase(deps: BaseDeps, name: string, color: string): string {
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const baseId = generateId();
	const prevBases = { ...(shape?.bases ?? {}) };
	const nextBases: Record<string, BaseInfo> = {
		...prevBases,
		[baseId]: { name, color, radius: DEFAULT_BASE_RADIUS },
	};
	const command: Command = {
		execute: () => deps.store.updateShape(id, { bases: nextBases } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { bases: prevBases } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
	return baseId;
}

/**
 * Make `cell` (a `cellKey("c,r")`) the (single) beacon of `baseId`. Enforces 1:1 —
 * any other base that used the same cell is detached. Undoable. No-op if the base
 * is missing or is already beaconed at `cell`.
 */
export function setBeacon(deps: BaseDeps, cell: string, baseId: string): void {
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const base = shape?.bases[baseId];
	if (!shape || !base) return;
	if (base.beaconCell === cell) return; // no change

	const prevBases = shape.bases;
	// Set this base's beacon cell; clear the same cell from any other base.
	const nextBases: Record<string, BaseInfo> = {};
	for (const [bid, info] of Object.entries(prevBases)) {
		if (bid === baseId) nextBases[bid] = { ...info, beaconCell: cell };
		else if (info.beaconCell === cell) nextBases[bid] = { ...info, beaconCell: undefined };
		else nextBases[bid] = info;
	}

	const command: Command = {
		execute: () => deps.store.updateShape(id, { bases: nextBases } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { bases: prevBases } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}

/** Set the active base's territory radius (in tiles). Clamped to >= 1. Undoable.
 *  No-op if the base is missing or the radius is unchanged. */
export function setBaseRadius(deps: BaseDeps, baseId: string, radius: number): void {
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const base = shape?.bases[baseId];
	if (!shape || !base) return;
	if (!Number.isFinite(radius)) return; // guard "" / undefined from a number input
	const r = Math.max(1, Math.round(radius));
	if (base.radius === r) return;
	const prevBases = shape.bases;
	const nextBases: Record<string, BaseInfo> = { ...prevBases, [baseId]: { ...base, radius: r } };
	const command: Command = {
		execute: () => deps.store.updateShape(id, { bases: nextBases } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { bases: prevBases } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}

/** Override the base's landmark icon (an ICONS key), or `null` to fall back to the
 *  radius-derived tier. Undoable. No-op if the base is missing or unchanged. */
export function setBaseIcon(deps: BaseDeps, baseId: string, icon: string | null): void {
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const base = shape?.bases[baseId];
	if (!shape || !base) return;
	const next = icon ?? undefined;
	if (base.icon === next) return;
	const nextInfo: BaseInfo = { ...base };
	if (next === undefined) delete nextInfo.icon;
	else nextInfo.icon = next;
	const prevBases = shape.bases;
	const nextBases: Record<string, BaseInfo> = { ...prevBases, [baseId]: nextInfo };
	const command: Command = {
		execute: () => deps.store.updateShape(id, { bases: nextBases } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { bases: prevBases } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}

/**
 * Remove a base from the registry (its derived territory disappears). Undoable.
 * No-op if the base doesn't exist.
 */
export function deleteBase(deps: BaseDeps, baseId: string): void {
	const { id } = resolveBaseMap(deps.store, deps.tile);
	const shape = deps.store.getShape(id) as BaseMapShapeData | undefined;
	const base = shape?.bases[baseId];
	if (!shape || !base) return;

	const prevBases = shape.bases;
	const nextBases: Record<string, BaseInfo> = {};
	for (const [bid, info] of Object.entries(prevBases)) {
		if (bid !== baseId) nextBases[bid] = info;
	}

	const command: Command = {
		execute: () => deps.store.updateShape(id, { bases: nextBases } as Partial<ShapeData>),
		undo: () => deps.store.updateShape(id, { bases: prevBases } as Partial<ShapeData>),
	};
	deps.commands.execute(command);
}
