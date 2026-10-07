import type { LiquidField } from "./liquid-field.js";

export type Rgb = readonly [number, number, number];

export interface ShadeParams {
	/** Liquid body colour. */
	color: Rgb;
	/** What shows through where the liquid has been pushed away (the canvas floor). */
	floor: Rgb;
	/** Ambient flow amplitude, 0–1 (0 = perfectly still surface). */
	flow: number;
	/** Animation time in seconds. */
	time: number;
}

/**
 * World distance over which one unit of thickness change reads as a 45° slope.
 * Slopes are computed per WORLD unit, so the surface looks the same at every zoom.
 */
const RELIEF = 22;
/** Unit light direction (upper-left, towards the viewer). */
const LIGHT: readonly [number, number, number] = normalize(-0.45, -0.65, 0.62);
/** Blinn-Phong half vector between {@link LIGHT} and the viewer (0, 0, 1). */
const HALF: readonly [number, number, number] = normalize(LIGHT[0], LIGHT[1], LIGHT[2] + 1);
const SHININESS = 48;
/** Reused per-frame buffer for the displayed surface height (shading is synchronous). */
let surfScratch = new Float32Array(0);
/** Reused per-frame buffer for the displayed thickness (meniscus applied). */
let thickScratch = new Float32Array(0);
/** Reused per-frame buffer for the blurred surface used for lighting. */
let blurScratch = new Float32Array(0);

/** One [1 2 1]/4 blur pass along x (`horizontal`) or y, clamping at the borders. */
function blur121(
	src: Float32Array,
	dst: Float32Array,
	cols: number,
	rows: number,
	horizontal: boolean,
): void {
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			let a: number;
			let b: number;
			if (horizontal) {
				a = src[c > 0 ? i - 1 : i];
				b = src[c < cols - 1 ? i + 1 : i];
			} else {
				a = src[r > 0 ? i - cols : i];
				b = src[r < rows - 1 ? i + cols : i];
			}
			dst[i] = (a + 2 * src[i] + b) * 0.25;
		}
	}
}

function normalize(x: number, y: number, z: number): [number, number, number] {
	const l = Math.hypot(x, y, z);
	return [x / l, y / l, z / l];
}

function smoothstep(e0: number, e1: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
}

/** Fade a wave term out once its wavelength drops under ~4 cells (avoids aliasing). */
function waveGain(frequency: number, cell: number): number {
	const cellsPerWave = (2 * Math.PI) / frequency / cell;
	return Math.min(1, Math.max(0, (cellsPerWave - 4) / 4));
}

/**
 * Slow, domain-warped surface undulation anchored to world coordinates, in
 * thickness units. Kept separate from the simulation so it never drifts volume.
 * `g0..g2` fade the individual terms (see {@link waveGain}).
 */
export function flowNoise(wx: number, wy: number, t: number, g0 = 1, g1 = 1, g2 = 1): number {
	const warp = 1.3 * Math.sin(wx * 0.006 - t * 0.11 + Math.sin(wy * 0.005 + t * 0.07));
	return (
		g0 * 0.45 * Math.sin(wx * 0.01 + t * 0.5 + 1.8 * Math.sin(wy * 0.008 + t * 0.23 + warp)) +
		g1 * 0.35 * Math.sin(wy * 0.014 - t * 0.37 + 1.6 * Math.sin(wx * 0.011 + t * 0.19 - warp)) +
		g2 * 0.2 * Math.sin(wx * 0.021 + t * 0.6 + warp) * Math.sin(wy * 0.019 - t * 0.5)
	);
}

/**
 * Shade `field` into `out` (RGBA, `field.cols × field.rows`, one pixel per cell):
 * a glossy, lit liquid surface whose relief comes from the thickness field plus
 * {@link flowNoise}, fading to the floor colour where the liquid was pushed away.
 */
export function shadeLiquid(field: LiquidField, out: Uint8ClampedArray, p: ShadeParams): void {
	const { cols, rows, cell, col0, row0 } = field;
	if (thickScratch.length < cols * rows) thickScratch = new Float32Array(cols * rows);
	const thick = thickScratch;
	const amp = 0.6 * Math.min(1, Math.max(0, p.flow));
	const g0 = waveGain(0.012, cell);
	const g1 = waveGain(0.016, cell);
	const g2 = waveGain(0.024, cell);
	// The liquid thins to nothing over this distance from an obstacle's outline: a
	// rounded meniscus that follows the true geometry rather than the cell grid.
	const meniscus = 1.5 * cell;

	// Displayed height per cell: simulated thickness + flow ripples (damped where thin).
	if (surfScratch.length < cols * rows) surfScratch = new Float32Array(cols * rows);
	const surf = surfScratch;
	for (let r = 0; r < rows; r++) {
		const wy = (row0 + r + 0.5) * cell;
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			const hi = field.h[i] * smoothstep(0, meniscus, field.edge[i]);
			thick[i] = hi;
			const wx = (col0 + c + 0.5) * cell;
			const ripple = amp > 0 ? amp * flowNoise(wx, wy, p.time, g0, g1, g2) : 0;
			surf[i] = hi + ripple * Math.min(1, hi);
		}
	}

	// Lighting reads a [1 2 1]² blur of the surface, so cell-quantized piles along
	// slanted edges don't sparkle as separate beads.
	if (blurScratch.length < cols * rows) blurScratch = new Float32Array(cols * rows);
	const smooth = blurScratch;
	blur121(surf, thick, cols, rows, true);
	blur121(thick, smooth, cols, rows, false);
	// `thick` was clobbered by the blur's first pass; rebuild it for coverage.
	for (let i = 0; i < cols * rows; i++) {
		thick[i] = field.h[i] * smoothstep(0, meniscus, field.edge[i]);
	}

	const [lr, lg, lb] = p.color;
	const [fr, fg, fb] = p.floor;
	const slopeScale = RELIEF / (2 * cell);
	for (let r = 0; r < rows; r++) {
		const rUp = r > 0 ? r - 1 : r;
		const rDown = r < rows - 1 ? r + 1 : r;
		for (let c = 0; c < cols; c++) {
			const i = r * cols + c;
			const cL = c > 0 ? c - 1 : c;
			const cR = c < cols - 1 ? c + 1 : c;
			const gx = (smooth[r * cols + cR] - smooth[r * cols + cL]) * slopeScale;
			const gy = (smooth[rDown * cols + c] - smooth[rUp * cols + c]) * slopeScale;
			// Surface normal of z = height(x, y).
			const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
			const nx = -gx * inv;
			const ny = -gy * inv;
			const nz = inv;

			const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
			const nh = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]);
			const spec = nh ** SHININESS * 0.85;

			const hi = thick[i];
			// Coverage: dry floor → liquid over the first ~third of the rest thickness.
			const cover = smoothstep(0.04, 0.4, hi);
			// Thicker liquid reads deeper (slightly darker); a lit/shadowed body.
			const depth = 1 - 0.18 * Math.min(1, Math.max(0, hi - 1));
			const shade = (0.62 + 0.48 * diffuse) * depth;
			const sr = lr * shade;
			const sg = lg * shade;
			const sb = lb * shade;
			const k = i * 4;
			out[k] = fr + (sr - fr) * cover + 255 * spec * cover;
			out[k + 1] = fg + (sg - fg) * cover + 255 * spec * cover;
			out[k + 2] = fb + (sb - fb) * cover + 255 * spec * cover;
			out[k + 3] = 255;
		}
	}
}
