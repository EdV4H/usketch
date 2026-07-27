// Extensible map-generator registry. Each generator turns a bounded cell box
// into a full Cells map (every cell assigned a terrain, water included) from a
// seed + numeric params, deterministically.
import { type CellBox, type Cells, cellKey } from "../autotile.js";
import type { TerrainKey } from "../terrain.js";
import { fbm } from "./noise.js";

export interface GenParam {
	name: string;
	label: string;
	type: "number";
	min: number;
	max: number;
	step: number;
	default: number;
}

export interface GenContext {
	box: CellBox;
	seed: number;
	params: Record<string, number>;
}

export interface MapGenerator {
	id: string;
	label: string;
	params: readonly GenParam[];
	/** Assign a TerrainKey to every cell in `ctx.box`. */
	generate(ctx: GenContext): Cells;
}

/**
 * Map a normalised elevation [0,1] to a terrain band, given a sea level. Land
 * bands are taken over the remaining height above sea level (`h` in [0,1]) so
 * every band stays reachable at any sea level.
 */
export function elevationToTerrain(e: number, seaLevel: number): TerrainKey {
	if (e < seaLevel) return "water";
	const h = (e - seaLevel) / Math.max(1e-6, 1 - seaLevel);
	if (h < 0.08) return "sand";
	if (h < 0.35) return "grass";
	if (h < 0.65) return "forest";
	if (h < 0.85) return "mtn";
	return "snow";
}

const P = (
	name: string,
	label: string,
	def: number,
	min: number,
	max: number,
	step: number,
): GenParam => ({
	name,
	label,
	type: "number",
	default: def,
	min,
	max,
	step,
});

/**
 * Shared elevation→terrain fill, optionally sinking box edges into the sea.
 *
 * The raw fBm value clusters around 0.5, which makes a fixed sea-level threshold
 * far too sensitive (a small default drowns everything). So we **contrast-stretch
 * the field to its own min/max within the box first**, giving `seaLevel` a stable,
 * intuitive meaning ("the lower fraction of the elevation range is water").
 */
type FillMode = "plain" | "sink" | "island";

function fillField(ctx: GenContext, mode: FillMode): Cells {
	const { box, seed, params } = ctx;
	const scale = params.scale ?? 0.08;
	const seaLevel = params.seaLevel ?? 0.4;
	const falloff = params.falloff ?? 0;
	const size = params.size ?? 3;
	const cols = box.maxC - box.minC + 1;
	const rows = box.maxR - box.minR + 1;

	// Pass 1: raw elevation + range for normalisation.
	const raw = new Array<number>(cols * rows);
	let min = Infinity;
	let max = -Infinity;
	let i = 0;
	for (let r = box.minR; r <= box.maxR; r++) {
		for (let c = box.minC; c <= box.maxC; c++) {
			const e = fbm(seed, c, r, scale);
			raw[i++] = e;
			if (e < min) min = e;
			if (e > max) max = e;
		}
	}
	const span = max - min;

	// Pass 2: normalise → (optional) island falloff → terrain band. A degenerate
	// flat field (span 0, e.g. a 1×1 box) maps to a neutral 0.5 so `seaLevel`
	// still has an effect instead of forcing everything to water.
	const normalize = (e: number) => (span > 0 ? (e - min) / span : 0.5);
	const cx = (box.minC + box.maxC) / 2;
	const cy = (box.minR + box.maxR) / 2;
	const hw = Math.max(1, (box.maxC - box.minC) / 2);
	const hh = Math.max(1, (box.maxR - box.minR) / 2);
	const cells: Cells = {};
	i = 0;
	for (let r = box.minR; r <= box.maxR; r++) {
		for (let c = box.minC; c <= box.maxC; c++) {
			let e = normalize(raw[i++]); // normalised to [0,1]
			if (mode !== "plain") {
				const nx = (c - cx) / hw;
				const ny = (r - cy) / hh;
				const d = Math.hypot(nx, ny); // 0 at centre, 1 at mid-edge, ~1.41 at a corner
				if (mode === "sink") {
					// Subtractive edge falloff → archipelago of islands.
					e -= falloff * Math.min(1, d) ** 2;
				} else {
					// Multiplicative radial mask → a single landmass guaranteed to be
					// surrounded by sea (mask is 0 at/after the box edge). Higher `size`
					// keeps land closer to the edge (a bigger island).
					e *= Math.max(0, 1 - d ** size);
				}
			}
			cells[cellKey(c, r)] = elevationToTerrain(e, seaLevel);
		}
	}
	return cells;
}

const noiseGenerator: MapGenerator = {
	id: "noise",
	label: "ノイズ地形（大陸）",
	params: [
		P("scale", "地形の細かさ", 0.08, 0.02, 0.3, 0.01),
		P("seaLevel", "海面", 0.3, 0, 0.9, 0.02),
	],
	generate: (ctx) => fillField(ctx, "plain"),
};

const islandGenerator: MapGenerator = {
	id: "island",
	label: "島（海に囲まれた1つの島）",
	params: [
		P("scale", "地形の細かさ", 0.09, 0.02, 0.3, 0.01),
		P("seaLevel", "海面", 0.3, 0, 0.9, 0.02),
		P("size", "島の大きさ", 3, 1.5, 6, 0.5),
	],
	generate: (ctx) => fillField(ctx, "island"),
};

const islandsGenerator: MapGenerator = {
	id: "islands",
	label: "群島（島々）",
	params: [
		P("scale", "地形の細かさ", 0.1, 0.02, 0.3, 0.01),
		P("seaLevel", "海面", 0.4, 0, 0.9, 0.02),
		P("falloff", "島らしさ（縁を海に）", 0.5, 0, 1, 0.05),
	],
	generate: (ctx) => fillField(ctx, "sink"),
};

export const GENERATORS: readonly MapGenerator[] = [
	noiseGenerator,
	islandGenerator,
	islandsGenerator,
];

export const GENERATORS_BY_ID: ReadonlyMap<string, MapGenerator> = new Map(
	GENERATORS.map((g) => [g.id, g]),
);

/** Default param values for a generator (used to seed gen-state). */
export function defaultParams(gen: MapGenerator): Record<string, number> {
	const out: Record<string, number> = {};
	for (const p of gen.params) out[p.name] = p.default;
	return out;
}
