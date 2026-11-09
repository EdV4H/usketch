// The infinite terrain: a height for every sample of the board from the field's seed and
// generator parameters. Every client computes it on its own (nothing of it is synced),
// so it must come out bit-for-bit the same everywhere: only integer hashing and plain
// + − × ÷ / floor are used — no Math.sin / pow / exp, whose last bits may differ
// between JS engines.
import type { ElevationGenParams } from "./elevation-field.js";

const S = Math.SQRT1_2;
/** Unit gradients of the gradient noise (8 directions, the constant is exact everywhere). */
const GRADIENTS: readonly (readonly [number, number])[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[S, S],
	[-S, S],
	[S, -S],
	[-S, -S],
];

/** A 32-bit hash of a lattice point and a seed (murmur3 finalizer). Pure. */
export function hash2(i: number, j: number, seed: number): number {
	let h =
		Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
	h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D gradient noise, about `-1 … 1`. Pure. */
export function gradientNoise(x: number, y: number, seed: number): number {
	const i0 = Math.floor(x);
	const j0 = Math.floor(y);
	const fx = x - i0;
	const fy = y - j0;
	const dot = (di: number, dj: number) => {
		const g = GRADIENTS[hash2(i0 + di, j0 + dj, seed) & 7];
		return g[0] * (fx - di) + g[1] * (fy - dj);
	};
	const u = fade(fx);
	const v = fade(fy);
	const a = dot(0, 0) + (dot(1, 0) - dot(0, 0)) * u;
	const b = dot(0, 1) + (dot(1, 1) - dot(0, 1)) * u;
	// Perlin noise in 2D stays within ±√½; scale it to about ±1.
	return (a + (b - a) * v) * Math.SQRT2;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The generated ground height (world units) at a world point, `0 … gen.relief`. Fractal
 * gradient noise gives the hills; ridged noise, mixed in more the higher the ground,
 * sharpens the peaks; the curve at the end flattens the lowlands (plains, coasts). Call
 * it on sample points (`index × spacing`) so the input has no rounding of its own. Pure.
 */
export function baseHeight(seed: number, gen: ElevationGenParams, wx: number, wy: number): number {
	let x = wx / gen.scale;
	let y = wy / gen.scale;
	let amp = 1;
	let total = 0;
	let sum = 0;
	let ridged = 0;
	for (let o = 0; o < gen.octaves; o++) {
		const n = gradientNoise(x, y, (seed + Math.imul(o, 1013904223)) | 0);
		sum += n * amp;
		const r = 1 - (n < 0 ? -n : n);
		ridged += r * r * amp;
		total += amp;
		amp *= gen.roughness;
		x *= 2;
		y *= 2;
	}
	const fbm = total > 0 ? sum / total : 0;
	const ridge = total > 0 ? ridged / total : 0;
	let e = clamp01(0.5 + fbm * 1.5);
	e = clamp01(e + (ridge - e) * gen.ridges * e);
	// Monotone on 0…1 with f(0)=0, f(1)=1 and a flat start: low ground stays low.
	return gen.relief * e * e * (1.5 - 0.5 * e);
}
