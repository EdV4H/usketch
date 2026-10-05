// Small seeded PRNG + hash utilities for deterministic map generation
// (same seed + params → same map). No external deps.

/** mulberry32: fast, decent-quality seeded PRNG returning floats in [0,1). */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Coerce a user-entered seed (number or string) to a 32-bit unsigned int. */
export function hashSeed(seed: number | string): number {
	if (typeof seed === "number") return seed >>> 0;
	let h = 2166136261 >>> 0; // FNV-1a
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/**
 * Stable per-lattice-point value from (seed, x, y) — no allocation.
 * NOTE: the final `h ^ (h >>> 16)` is a JS bitwise op, so it yields a *signed*
 * int32; divided by 2^32 the result is **centred on 0 in ~[-0.5, 0.5)**, not
 * [0, 1). Callers (value noise / fBm) rely on this zero-centring.
 */
export function hash2(seed: number, x: number, y: number): number {
	let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	// Signed int32 (top bit → negative) / 2^32 ⇒ ~[-0.5, 0.5).
	return (h ^ (h >>> 16)) / 4294967296;
}
