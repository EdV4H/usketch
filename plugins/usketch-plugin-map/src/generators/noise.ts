// Deterministic value-noise elevation field (fBm) — no external deps.
// Elevation is sampled per cell. `hash2` is zero-centred (~[-0.5, 0.5)), so the
// noise and fBm below are likewise **centred on 0** (roughly [-0.5, 0.5)), NOT
// [0, 1). Consumers that want a band split apply their own contrast window.
import { hash2 } from "./rng.js";

function smoothstep(t: number): number {
	return t * t * (3 - 2 * t);
}

/** Bilinear value noise at (x,y) using a seeded integer lattice. Zero-centred,
 * range ~[-0.5, 0.5) (inherited from `hash2`). */
function valueNoise2D(seed: number, x: number, y: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = smoothstep(x - x0);
	const fy = smoothstep(y - y0);
	const v00 = hash2(seed, x0, y0);
	const v10 = hash2(seed, x0 + 1, y0);
	const v01 = hash2(seed, x0, y0 + 1);
	const v11 = hash2(seed, x0 + 1, y0 + 1);
	const top = v00 + (v10 - v00) * fx;
	const bottom = v01 + (v11 - v01) * fx;
	return top + (bottom - top) * fy;
}

/**
 * fractal Brownian motion: sum of octaves of value noise. `scale` sets the base
 * frequency (world-cell → noise space). The amplitude-weighted average keeps the
 * output in the same **zero-centred ~[-0.5, 0.5)** domain as the value noise
 * (empirically ≈[-0.41, 0.40] at the default scale) — it is NOT [0, 1].
 */
export function fbm(seed: number, cx: number, cy: number, scale: number, octaves = 4): number {
	let amp = 1;
	let freq = scale;
	let sum = 0;
	let norm = 0;
	for (let o = 0; o < octaves; o++) {
		// Vary the lattice per octave so they don't align.
		sum += amp * valueNoise2D(seed + o * 1013, cx * freq, cy * freq);
		norm += amp;
		amp *= 0.5;
		freq *= 2;
	}
	return norm > 0 ? sum / norm : 0;
}
