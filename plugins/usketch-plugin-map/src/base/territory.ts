// Derived base territory. A base's area is NOT stored — it is computed from its
// beacon (a grid cell) + the terrain paint:
//   • the CORE disk (radius tiles around the beacon cell) is ALWAYS owned, and
//   • it then expands through HAND-PAINTED, non-excluded cells 4-connected to the
//     core (no radius cap). GENERATED terrain is not walkable — so a generated
//     continent is never auto-claimed; the user grows a base by hand-painting
//     land connected to it. Excluded terrain (e.g. water) is a wall.
// Memoised by the tilemap `cells` object identity + a beacon signature, so it
// only recomputes when paint or a beacon (position/radius/set) actually changes.
import type { BoardStore } from "@edv4h/usketch-shared";
import { type Cells, cellKey, parseCellKey, worldToCell } from "../autotile.js";
import { isTileMap, type TileMapShapeData } from "../tilemap-shape.js";
import { type BaseInfo, type BaseMapShapeData, isBaseMap } from "./base-map-shape.js";

/** cellKey("c,r") → baseId. Same shape as the old OwnerMap so renderers reuse it. */
export type Territory = Record<string, string>;

interface Beacon {
	baseId: string;
	cx: number;
	cy: number;
	radius: number;
}

const EMPTY_CELLS: Cells = {};
const EMPTY_HAND_PAINT: Record<string, true> = {};
const cache = new WeakMap<Cells, Map<string, Territory>>();

function findBaseMap(store: BoardStore): BaseMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isBaseMap(s)) return s;
	return undefined;
}

function findTilemap(store: BoardStore): TileMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isTileMap(s)) return s;
	return undefined;
}

function collectBeacons(bases: Record<string, BaseInfo>, tile: number): Beacon[] {
	const out: Beacon[] = [];
	for (const [baseId, info] of Object.entries(bases)) {
		if (!info.beaconCell) continue;
		const [col, row] = parseCellKey(info.beaconCell);
		// Seed the core disk from the cell CENTRE (world coords), so the existing
		// distance-based rasterization in build() is unchanged.
		out.push({
			baseId,
			cx: (col + 0.5) * tile,
			cy: (row + 0.5) * tile,
			radius: info.radius,
		});
	}
	return out;
}

function signature(beacons: Beacon[], exclude: ReadonlySet<string>): string {
	const b = beacons
		.map((x) => `${x.baseId}:${Math.round(x.cx)}:${Math.round(x.cy)}:${x.radius}`)
		.sort()
		.join("|");
	return `${b}#${[...exclude].sort().join(",")}`;
}

function build(
	beacons: Beacon[],
	cells: Cells,
	handPaint: Record<string, true>,
	tile: number,
	exclude: ReadonlySet<string>,
): Territory {
	const territory: Territory = {};
	const queue: [number, number][] = [];

	// 1) Core disk: every cell within `radius` of a beacon is owned, regardless of
	//    paint. Sorted so overlapping cores resolve deterministically (first wins).
	const sorted = [...beacons].sort((a, b) => (a.baseId < b.baseId ? -1 : 1));
	for (const bec of sorted) {
		const [cc, cr] = worldToCell(bec.cx, bec.cy, tile);
		const rSq = (bec.radius * tile) ** 2;
		const span = Math.ceil(bec.radius);
		for (let r = cr - span; r <= cr + span; r++) {
			for (let c = cc - span; c <= cc + span; c++) {
				const dx = (c + 0.5) * tile - bec.cx;
				const dy = (r + 0.5) * tile - bec.cy;
				if (dx * dx + dy * dy > rSq) continue;
				const k = cellKey(c, r);
				if (k in territory) continue;
				territory[k] = bec.baseId;
				queue.push([c, r]);
			}
		}
	}

	// 2) Growth: expand from the core through HAND-PAINTED, non-excluded cells
	//    (no radius cap). Generated terrain is NOT walkable, so a generated
	//    continent is never auto-claimed — only land the user hand-painted.
	for (let head = 0; head < queue.length; head++) {
		const [c, r] = queue[head];
		const baseId = territory[cellKey(c, r)];
		for (const [nc, nr] of [
			[c + 1, r],
			[c - 1, r],
			[c, r + 1],
			[c, r - 1],
		] as [number, number][]) {
			const k = cellKey(nc, nr);
			if (k in territory) continue;
			if (!(k in handPaint)) continue; // only hand-painted land expands
			if (exclude.has(cells[k])) continue; // hand-painted wall (e.g. water)
			territory[k] = baseId;
			queue.push([nc, nr]);
		}
	}
	return territory;
}

/**
 * The derived territory (cellKey → baseId) for the whole board. Empty when there
 * is no base-map or no base has a live beacon.
 */
export function computeTerritory(
	store: BoardStore,
	tile: number,
	exclude: ReadonlySet<string>,
): Territory {
	const base = findBaseMap(store);
	if (!base || Object.keys(base.bases).length === 0) return {};
	const tilemap = findTilemap(store);
	const cells = tilemap?.cells ?? EMPTY_CELLS;
	const handPaint = tilemap?.handPaint ?? EMPTY_HAND_PAINT;
	const t = tilemap?.tile ?? tile;
	const beacons = collectBeacons(base.bases, t);
	if (beacons.length === 0) return {};
	const sig = signature(beacons, exclude);

	// Keyed by the `cells` object: it gets a fresh identity on every paint/generate
	// commit, and `handPaint` always changes alongside it, so this stays correct.
	let bySig = cache.get(cells);
	if (!bySig) {
		bySig = new Map();
		cache.set(cells, bySig);
	}
	const cached = bySig.get(sig);
	if (cached) return cached;
	const result = build(beacons, cells, handPaint, t, exclude);
	bySig.set(sig, result);
	return result;
}
