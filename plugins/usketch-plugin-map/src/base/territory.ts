// Derived base territory. A base's area is NOT stored — it is computed from its
// beacon (a map-icon) + the terrain paint:
//   • the core disk (radius tiles around the beacon) is ALWAYS owned, and
//   • painted, non-excluded cells 4-connected to that core are owned too
//     (disconnected paint is NOT owned; excluded terrain, e.g. water, is a wall).
// Multi-source BFS → the nearest beacon claims contested painted cells. Memoised
// by the tilemap `cells` object identity + a beacon signature, so it only
// recomputes when paint or a beacon (position/radius/set) actually changes.
import type { BoardStore } from "@edv4h/usketch-shared";
import { type Cells, cellKey, worldToCell } from "../autotile.js";
import { MAP_ICON_TYPE, type MapIconShapeData } from "../map-icon-shape.js";
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
const cache = new WeakMap<Cells, Map<string, Territory>>();

function findBaseMap(store: BoardStore): BaseMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isBaseMap(s)) return s;
	return undefined;
}

function findTilemap(store: BoardStore): TileMapShapeData | undefined {
	for (const [, s] of store.getShapes()) if (isTileMap(s)) return s;
	return undefined;
}

function collectBeacons(store: BoardStore, bases: Record<string, BaseInfo>): Beacon[] {
	const icons = new Map<string, MapIconShapeData>();
	for (const [, s] of store.getShapes()) {
		if (s.type === MAP_ICON_TYPE) icons.set(s.id, s as MapIconShapeData);
	}
	const out: Beacon[] = [];
	for (const [baseId, info] of Object.entries(bases)) {
		if (!info.beaconIconId) continue;
		const icon = icons.get(info.beaconIconId);
		if (!icon) continue;
		out.push({
			baseId,
			cx: icon.x + icon.width / 2,
			cy: icon.y + icon.height / 2,
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
	tile: number,
	exclude: ReadonlySet<string>,
): Territory {
	const territory: Territory = {};
	const queue: [number, number][] = [];

	// Seed core disks — always owned, paint-independent. Sorted so overlapping
	// cores resolve deterministically (first baseId wins).
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

	// BFS growth through painted, non-excluded cells (nearest beacon wins).
	for (let head = 0; head < queue.length; head++) {
		const [c, r] = queue[head];
		const baseId = territory[cellKey(c, r)];
		const neighbours: [number, number][] = [
			[c + 1, r],
			[c - 1, r],
			[c, r + 1],
			[c, r - 1],
		];
		for (const [nc, nr] of neighbours) {
			const k = cellKey(nc, nr);
			if (k in territory) continue;
			// Growth only crosses EXPLICITLY painted, non-excluded cells. Unpainted
			// space (even when it renders as the `emptyTerrain`, e.g. sea) is NOT
			// walkable — otherwise the flood would never terminate.
			const t = cells[k];
			if (t === undefined || exclude.has(t)) continue;
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
	const beacons = collectBeacons(store, base.bases);
	if (beacons.length === 0) return {};
	const tilemap = findTilemap(store);
	const cells = tilemap?.cells ?? EMPTY_CELLS;
	const t = tilemap?.tile ?? tile;
	const sig = signature(beacons, exclude);

	let bySig = cache.get(cells);
	if (!bySig) {
		bySig = new Map();
		cache.set(cells, bySig);
	}
	const cached = bySig.get(sig);
	if (cached) return cached;
	const result = build(beacons, cells, t, exclude);
	bySig.set(sig, result);
	return result;
}
