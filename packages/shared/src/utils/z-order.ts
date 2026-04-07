import { generateNKeysBetween } from "fractional-indexing";

/**
 * Number of candidate keys generated at each step. We pick one at random to
 * reduce the chance of collision when two clients insert at the same slot
 * concurrently under Yjs sync. Larger values reduce collision probability
 * but increase key-length growth slightly.
 */
const JITTER_SLOTS = 16;

/**
 * Generate a jittered fractional index key between two neighbors.
 *
 * Uses `generateNKeysBetween(lower, upper, N)` and picks one key at random.
 * All generated keys are valid fractional-indexing keys and satisfy
 * `lower < key < upper` lexicographically. Picking randomly among N slots
 * means two concurrent clients are unlikely to pick the same slot, avoiding
 * LWW collisions under Yjs sync.
 */
export function zIndexBetween(lower: string | null, upper: string | null): string {
	const keys = generateNKeysBetween(lower, upper, JITTER_SLOTS);
	const pick = keys[Math.floor(Math.random() * keys.length)];
	// generateNKeysBetween always returns JITTER_SLOTS keys, but fall back defensively.
	return pick ?? keys[0] ?? "a0";
}

/** Compare two z-index keys. Returns negative/zero/positive like localeCompare. */
export function compareZIndex(a: string | undefined, b: string | undefined): number {
	if (a === b) return 0;
	if (a === undefined) return -1;
	if (b === undefined) return 1;
	return a < b ? -1 : a > b ? 1 : 0;
}

/** Generate a zIndex that sorts after all given keys. */
export function zIndexAfterAll(keys: readonly (string | undefined)[]): string {
	const sorted = keys.filter((k): k is string => typeof k === "string").sort();
	const max = sorted.at(-1) ?? null;
	return zIndexBetween(max, null);
}

/** Generate a zIndex that sorts before all given keys. */
export function zIndexBeforeAll(keys: readonly (string | undefined)[]): string {
	const sorted = keys.filter((k): k is string => typeof k === "string").sort();
	const min = sorted.at(0) ?? null;
	return zIndexBetween(null, min);
}
