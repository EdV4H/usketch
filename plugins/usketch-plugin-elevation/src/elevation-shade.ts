// What the flat board shows of the elevation: colours by height (water, beach, grass,
// earth, rock, snow), shading from a light in the north-west so slopes read as relief,
// and contour lines. One tile = one chunk at some level of detail, drawn to RGBA pixels
// here (pure, testable) and put on a <canvas> by the layer.
import { DEFAULT_GEN } from "./elevation-field.js";
import type { ElevationSampler } from "./elevation-model.js";

/** How the elevation is drawn (app-local look, not synced). */
export interface ElevationDisplay {
	/** Colour by height. Off: only shading + contours, over whatever ground is below. */
	tint: boolean;
	/** Shade slopes by a light from the north-west. */
	shade: boolean;
	/** World units between contour lines; 0 = none. */
	contour: number;
}

export const DEFAULT_DISPLAY: ElevationDisplay = { tint: true, shade: true, contour: 32 };

type Rgb = readonly [number, number, number];

/** Land colours by `(h − water) / (relief − water)`. */
const LAND: readonly (readonly [number, Rgb])[] = [
	[0, [226, 214, 166]],
	[0.04, [150, 196, 108]],
	[0.3, [104, 156, 84]],
	[0.55, [170, 150, 108]],
	[0.75, [140, 132, 120]],
	[0.9, [242, 242, 238]],
];
const SHALLOW: Rgb = [116, 186, 214];
const DEEP: Rgb = [44, 104, 156];

function ramp(stops: readonly (readonly [number, Rgb])[], t: number): Rgb {
	if (t <= stops[0][0]) return stops[0][1];
	for (let k = 1; k < stops.length; k++) {
		const [t1, c1] = stops[k];
		if (t <= t1) {
			const [t0, c0] = stops[k - 1];
			const f = (t - t0) / (t1 - t0);
			return [
				c0[0] + (c1[0] - c0[0]) * f,
				c0[1] + (c1[1] - c0[1]) * f,
				c0[2] + (c1[2] - c0[2]) * f,
			];
		}
	}
	return stops[stops.length - 1][1];
}

/** Colour of the ground at height `h`: land by height above the water, water by depth. Pure. */
export function heightColor(h: number, water: number | null, relief: number): Rgb {
	if (water !== null && h < water) {
		const depth = water > 0 ? (water - h) / water : 1;
		const f = depth > 1 ? 1 : depth;
		return [
			SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * f,
			SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * f,
			SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * f,
		];
	}
	const lo = water ?? 0;
	const span = relief - lo > 1 ? relief - lo : 1;
	return ramp(LAND, (h - lo) / span);
}

// Light from the north-west, raised 50°-ish.
const LIGHT = (() => {
	const x = -1;
	const y = -1;
	const z = 1.7;
	const len = Math.hypot(x, y, z);
	return [x / len, y / len, z / len] as const;
})();
/** Slopes look steeper than they are, so gentle hills still read. */
const EXAGGERATION = 1.2;

/** Brightness factor of a slope `(gx, gy)` (height per world unit): 1 on flat ground. Pure. */
export function shadeFactor(gx: number, gy: number): number {
	const nx = -gx * EXAGGERATION;
	const ny = -gy * EXAGGERATION;
	const len = Math.sqrt(nx * nx + ny * ny + 1);
	const s = (nx * LIGHT[0] + ny * LIGHT[1] + LIGHT[2]) / len;
	const f = 1 + (s - LIGHT[2]) * 1.3;
	return f < 0.55 ? 0.55 : f > 1.3 ? 1.3 : f;
}

export interface TileRequest {
	sampler: ElevationSampler;
	/** Level of detail: the tile is the level's chunk `(tx, ty)`, samples every `2^level`. */
	level: number;
	tx: number;
	ty: number;
	/** Pixels along the tile's side. */
	size: number;
	/**
	 * Extra pixels drawn past every edge (the bitmap is `size + 2·margin` wide): a
	 * scaled-up canvas blends its outermost pixels with transparency, so the layer lets
	 * neighbouring tiles overlap by this much to leave no seam. Default 0.
	 */
	margin?: number;
	display: ElevationDisplay;
}

/**
 * The tile's pixels (RGBA, `(size + 2·margin)²`). Heights and slopes are interpolated between the
 * samples, so the tile looks smooth at any size. On a field without generated terrain,
 * flat ground (height 0) is transparent and the hills fade in over their first few
 * units, so the board shows around them. Pure.
 */
export function renderTilePixels(req: TileRequest): Uint8ClampedArray {
	const { sampler, level, tx, ty, size, display } = req;
	const margin = Math.max(0, Math.floor(req.margin ?? 0));
	const full = size + 2 * margin;
	const field = sampler.field;
	const n = field.chunk;
	const step = 2 ** level;
	const seeded = field.seed !== null;
	const water = field.waterLevel;
	const relief = seeded ? field.gen.relief : DEFAULT_GEN.relief;

	// Heights on the tile's samples plus two rings around them: the margin's pixels and
	// the slopes at the edge read one sample past the tile, and a slope one more.
	const w = n + 5;
	const grid = new Float32Array(w * w);
	for (let lj = -2; lj <= n + 2; lj++) {
		for (let li = -2; li <= n + 2; li++) {
			grid[(lj + 2) * w + (li + 2)] = sampler.sample(
				(tx * n + li) * step,
				(ty * n + lj) * step,
				level,
			);
		}
	}
	// Slopes at the samples and one ring around (central differences), height per world unit.
	const g = n + 3;
	const gxs = new Float32Array(g * g);
	const gys = new Float32Array(g * g);
	const span = 2 * step * field.spacing;
	for (let lj = -1; lj <= n + 1; lj++) {
		for (let li = -1; li <= n + 1; li++) {
			const c = (lj + 2) * w + (li + 2);
			gxs[(lj + 1) * g + (li + 1)] = (grid[c + 1] - grid[c - 1]) / span;
			gys[(lj + 1) * g + (li + 1)] = (grid[c + w] - grid[c - w]) / span;
		}
	}

	const heights = new Float32Array(full * full);
	const out = new Uint8ClampedArray(full * full * 4);
	const scale = n / size;
	const cell = (t: number) => Math.min(n, Math.max(-1, Math.floor(t)));
	for (let py = 0; py < full; py++) {
		const v = (py - margin + 0.5) * scale;
		const lj = cell(v);
		const ty2 = v - lj;
		for (let px = 0; px < full; px++) {
			const u = (px - margin + 0.5) * scale;
			const li = cell(u);
			const tx2 = u - li;
			const bl = (a: number, b: number, c: number, d: number) => {
				const top = a + (b - a) * tx2;
				return top + (c + (d - c) * tx2 - top) * ty2;
			};
			const c = (lj + 2) * w + (li + 2);
			const h = bl(grid[c], grid[c + 1], grid[c + w], grid[c + w + 1]);
			heights[py * full + px] = h;
			const k = (lj + 1) * g + (li + 1);
			const f = display.shade
				? shadeFactor(
						bl(gxs[k], gxs[k + 1], gxs[k + g], gxs[k + g + 1]),
						bl(gys[k], gys[k + 1], gys[k + g], gys[k + g + 1]),
					)
				: 1;
			const o = (py * full + px) * 4;
			const underwater = water !== null && h < water;
			const alpha = seeded || water !== null ? 1 : h >= 6 ? 1 : h <= 0 ? 0 : h / 6;
			if (display.tint) {
				const [r, gr, b] = heightColor(h, water, relief);
				const lit = underwater ? 1 : f;
				out[o] = r * lit;
				out[o + 1] = gr * lit;
				out[o + 2] = b * lit;
				out[o + 3] = 255 * alpha;
			} else if (!underwater) {
				// Shading alone: darken / lighten whatever ground is below.
				const dark = f < 1;
				const v2 = dark ? 0 : 255;
				out[o] = v2;
				out[o + 1] = v2;
				out[o + 2] = v2;
				out[o + 3] = 255 * alpha * (dark ? (1 - f) * 0.9 : (f - 1) * 0.6);
			}
		}
	}

	if (display.contour > 0) {
		const c = display.contour;
		for (let py = 0; py < full; py++) {
			for (let px = 0; px < full; px++) {
				const idx = py * full + px;
				const h = heights[idx];
				if (h <= 0 || (water !== null && h < water)) continue;
				const band = Math.floor(h / c);
				const right = px + 1 < full ? Math.floor(heights[idx + 1] / c) : band;
				const down = py + 1 < full ? Math.floor(heights[idx + full] / c) : band;
				if (band === right && band === down) continue;
				const o = idx * 4;
				if (display.tint) {
					out[o] *= 0.62;
					out[o + 1] *= 0.62;
					out[o + 2] *= 0.62;
				} else {
					out[o] = 0;
					out[o + 1] = 0;
					out[o + 2] = 0;
					out[o + 3] = Math.max(out[o + 3], 90);
				}
			}
		}
	}
	return out;
}
