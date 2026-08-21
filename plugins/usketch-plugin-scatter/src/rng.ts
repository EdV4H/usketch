// Small seeded PRNG so random scatter patterns are reproducible (same seed → same
// layout) for tests/repro. Copied from the map plugin's generators/rng.ts (not
// shared). No external deps.

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

/** Coerce a user seed (number or string) to a 32-bit unsigned int. */
export function hashSeed(seed: number | string): number {
	if (typeof seed === "number") return seed >>> 0;
	let h = 2166136261 >>> 0; // FNV-1a
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
