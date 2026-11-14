// Public API for the infinite base terrain (#937, #946 follow-up). The seed lives
// on the `tilemap` SHAPE (synced/persisted), not an app-local store, so these are
// functions over a BoardStore rather than a module-scoped reactive store. They run
// the exact same enable/seed logic as the Control HUD "無限地形" toggle, so a host
// with its own UI (ActionRing / radial / toolbar) can drive it without the HUD.
import type { BoardStore } from "@edv4h/usketch-shared";
import {
	type BaseGenOptions,
	type BaseGenParams,
	DEFAULT_BASE_GEN,
	REGION_SIZE_RANGE,
	resolveBaseGen,
	scaleForRegionSize,
	withBaseGen,
} from "./base-terrain.js";
import { resolveTilemap } from "./generate.js";
import {
	DEFAULT_TILE,
	isTileMap,
	lowestTilemap,
	seededTilemap,
	type TileMapShapeData,
} from "./tilemap-shape.js";

/** Seed used when enabling without an explicit one (matches the HUD default). */
export const DEFAULT_INFINITE_SEED = 12345;

export interface EnableInfiniteTerrainOptions {
	/**
	 * Seed for the world. Rounded to an integer. Omitted → keep the current seed if
	 * already enabled, else {@link DEFAULT_INFINITE_SEED}.
	 */
	seed?: number;
	/** Tile size for a tilemap created on a blank board. Default {@link DEFAULT_TILE}. */
	tile?: number;
	/**
	 * How the world is generated: `scale` (smaller ⇒ larger land / forest / mountain
	 * regions at the same tile size; default 0.05) and `seaLevel` (0–1, larger ⇒ more
	 * sea; default 0.42). Given values replace the board's current ones (else the
	 * defaults), so the world changes; omitted, the board keeps its recorded params.
	 * Throws `RangeError` on an out-of-range value.
	 */
	gen?: BaseGenOptions;
}

/** The board's effective infinite-terrain seed, or `null` when disabled. */
export function getInfiniteSeed(store: BoardStore): number | null {
	return seededTilemap(store.getShapes().values())?.baseSeed ?? null;
}

/**
 * The tilemap the infinite terrain lives on (or will, when enabled): the seeded one,
 * else the lowest-id one. Deterministic, so every synced client picks the same.
 */
function terrainTarget(store: BoardStore): TileMapShapeData | null {
	return seededTilemap(store.getShapes().values()) ?? lowestTilemap(store.getShapes().values());
}

/**
 * The board's infinite-terrain generation params: the ones in use while enabled,
 * else the ones turning it on will use (recorded on the board, or the defaults).
 */
export function getInfiniteGen(store: BoardStore): BaseGenParams {
	return resolveBaseGen(terrainTarget(store)?.baseGen);
}

/** Whether the infinite base terrain is enabled on the board. */
export function isInfiniteTerrainEnabled(store: BoardStore): boolean {
	return getInfiniteSeed(store) != null;
}

/**
 * Enable (or re-seed) the infinite base terrain — the same operation the HUD
 * toggle runs. Stamps `baseSeed` + a frozen `baseGen` onto the deterministically
 * chosen tilemap: an already-seeded one, else the lowest-id tilemap, else a freshly
 * created one on a blank board. Persists + syncs (it's shape data). Returns the
 * integer seed applied. Throws `RangeError` on a non-finite seed or a non-finite /
 * non-positive `tile`.
 */
export function enableInfiniteTerrain(
	store: BoardStore,
	opts: EnableInfiniteTerrainOptions = {},
): number {
	const raw = opts.seed ?? getInfiniteSeed(store) ?? DEFAULT_INFINITE_SEED;
	const seed = Math.trunc(Number(raw));
	if (!Number.isFinite(seed)) {
		throw new RangeError(`enableInfiniteTerrain: seed must be a finite number, got ${String(raw)}`);
	}
	// Validate the tile size — it feeds cell math (move/viewport divide by tile), so
	// a non-finite/non-positive value would later cause NaN/÷0 cells.
	const tile = opts.tile ?? DEFAULT_TILE;
	if (!Number.isFinite(tile) || tile <= 0) {
		throw new RangeError(
			`enableInfiniteTerrain: tile must be a finite positive number, got ${String(opts.tile)}`,
		);
	}
	// Deterministic target so every synced client agrees (see seededTilemap). Reuse
	// the target's own recorded gen if present so re-enabling keeps the same world
	// even after the default gen advances; the host's `gen` goes on top of it.
	const target = terrainTarget(store);
	const recorded = target?.baseGen ?? DEFAULT_BASE_GEN;
	// Validate before touching the board, so a bad value creates no tilemap either.
	const baseGen = opts.gen ? withBaseGen(resolveBaseGen(recorded), opts.gen) : recorded;
	const id = target?.id ?? resolveTilemap(store, tile).id;
	store.updateShape(id, { baseSeed: seed, baseGen } as Partial<TileMapShapeData>);
	return seed;
}

/**
 * Change the generation params of the board's infinite terrain. While it's on this
 * re-generates the world (same seed); while it's off the params are recorded on the
 * board and used when it's turned on. Returns `false` (no-op) on a board with no
 * tilemap yet: pass `gen` to {@link enableInfiniteTerrain} instead. Throws
 * `RangeError` on an out-of-range value (see `withBaseGen`).
 */
export function setInfiniteGen(store: BoardStore, gen: BaseGenOptions): boolean {
	const target = terrainTarget(store);
	if (!target) return false;
	const baseGen = withBaseGen(resolveBaseGen(target.baseGen), gen);
	store.updateShape(target.id, { baseGen } as Partial<TileMapShapeData>);
	return true;
}

/** A board's 「領域の広さ」 (a multiple of the default) and 「海の割合」 (0–1). */
export interface InfiniteRegionOptions {
	regionSize?: number;
	seaLevel?: number;
}

/**
 * {@link setInfiniteGen} in the terms a settings UI shows: a region size (clamped to
 * {@link REGION_SIZE_RANGE}) and a sea level (clamped to 0–1). Non-finite values are
 * ignored. Returns whether anything was applied.
 */
export function setInfiniteRegion(store: BoardStore, opts: InfiniteRegionOptions): boolean {
	const gen: BaseGenOptions = {};
	if (Number.isFinite(opts.regionSize)) {
		const size = Math.min(
			REGION_SIZE_RANGE.max,
			Math.max(REGION_SIZE_RANGE.min, opts.regionSize as number),
		);
		gen.scale = scaleForRegionSize(size);
	}
	if (Number.isFinite(opts.seaLevel)) {
		gen.seaLevel = Math.min(1, Math.max(0, opts.seaLevel as number));
	}
	if (gen.scale === undefined && gen.seaLevel === undefined) return false;
	return setInfiniteGen(store, gen);
}

/** Disable the infinite base terrain (clears `baseSeed` on every seeded tilemap). */
export function disableInfiniteTerrain(store: BoardStore): void {
	for (const [id, s] of store.getShapes()) {
		if (isTileMap(s) && s.baseSeed != null) {
			store.updateShape(id, { baseSeed: undefined } as Partial<TileMapShapeData>);
		}
	}
}

/**
 * Set the seed: a number enables/re-seeds, `null` disables — the "reactive setter"
 * ergonomics requested in #946 (`set({ seed })` / `set({ seed: null })`), backed by
 * the functions above so behaviour is identical to the HUD.
 */
export function setInfiniteSeed(store: BoardStore, seed: number | null): void {
	if (seed == null) disableInfiniteTerrain(store);
	else enableInfiniteTerrain(store, { seed });
}
