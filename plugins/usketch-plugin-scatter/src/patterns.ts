// Layout patterns: pure functions placing the related items around the seed. All
// take a PatternContext and return Placements (top-left x/y + optional rotation).
// Registerable so hosts can add their own; built-ins self-register on import.

import { findFreePosition } from "@edv4h/usketch-shape-utils";
import type { BoundingBox } from "@edv4h/usketch-shared";
import type { PatternItem, Placement, ScatterPattern } from "./types.js";

const TAU = Math.PI * 2;

/** Largest single item dimension (a lower bound for spacing between items). */
function maxItemDim(items: PatternItem[]): number {
	let m = 1;
	for (const it of items) m = Math.max(m, it.bounds.width, it.bounds.height);
	return m;
}

/** Convert a target CENTER to a top-left placement for an item of these bounds. */
function atCenter(
	key: string,
	cx: number,
	cy: number,
	b: BoundingBox,
	rotation?: number,
): Placement {
	return { key, x: cx - b.width / 2, y: cy - b.height / 2, rotation };
}

/** Even ring(s) around the seed centre. Ring radius grows to fit all items without
 *  overlap (arc length per item ≥ item size + spacing). */
export const radialPattern: ScatterPattern = ({ seedBounds, seedCenter, items, spacing }) => {
	const n = items.length;
	if (n === 0) return [];
	const dim = maxItemDim(items);
	const seedR = Math.max(seedBounds.width, seedBounds.height) / 2;
	const circumferenceNeed = n * (dim + spacing);
	const radius = Math.max(seedR + dim / 2 + spacing, circumferenceNeed / TAU);
	return items.map((it, i) => {
		const a = (i / n) * TAU;
		return atCenter(
			it.key,
			seedCenter.x + Math.cos(a) * radius,
			seedCenter.y + Math.sin(a) * radius,
			it.bounds,
		);
	});
};

/** Random offsets within a radius + a small random rotation — the chaotic
 *  "dumped out" look. Deterministic given the seed (uses ctx.rng). */
export const scatterPattern: ScatterPattern = ({ seedBounds, seedCenter, items, spacing, rng }) => {
	const n = items.length;
	if (n === 0) return [];
	const dim = maxItemDim(items);
	const seedR = Math.max(seedBounds.width, seedBounds.height) / 2;
	const spread = Math.max(seedR * 2 + dim, Math.sqrt(n) * (dim + spacing));
	return items.map((it) => {
		const ang = rng() * TAU;
		const dist = (0.35 + 0.65 * rng()) * spread;
		const rotation = (rng() * 2 - 1) * 22; // ±22°
		return atCenter(
			it.key,
			seedCenter.x + Math.cos(ang) * dist,
			seedCenter.y + Math.sin(ang) * dist,
			it.bounds,
			rotation,
		);
	});
};

/** Non-overlapping cluster: place each item near the seed, then push it to the
 *  nearest free spot (delegates to findFreePosition), accumulating placed AABBs so
 *  items don't collide with each other either. */
export const unoverlapPattern: ScatterPattern = ({ seedCenter, items, occupied, spacing }) => {
	const placed: BoundingBox[] = [...occupied];
	const out: Placement[] = [];
	for (const it of items) {
		const desired: BoundingBox = {
			x: seedCenter.x - it.bounds.width / 2,
			y: seedCenter.y - it.bounds.height / 2,
			width: it.bounds.width,
			height: it.bounds.height,
		};
		const free = findFreePosition({
			desired,
			occupied: placed,
			strategy: "ring",
			step: Math.max(8, spacing),
		});
		placed.push(free);
		out.push({ key: it.key, x: free.x, y: free.y });
	}
	return out;
};

/** Square-ish grid centred on the seed; cells sized to the largest item + spacing. */
export const gridPattern: ScatterPattern = ({ seedCenter, items, spacing }) => {
	const n = items.length;
	if (n === 0) return [];
	const dim = maxItemDim(items);
	const cell = dim + spacing;
	const cols = Math.ceil(Math.sqrt(n));
	const rows = Math.ceil(n / cols);
	const startX = seedCenter.x - (cols * cell) / 2 + cell / 2;
	const startY = seedCenter.y - (rows * cell) / 2 + cell / 2;
	return items.map((it, i) => {
		const c = i % cols;
		const r = Math.floor(i / cols);
		return atCenter(it.key, startX + c * cell, startY + r * cell, it.bounds);
	});
};

const PATTERNS = new Map<string, ScatterPattern>([
	["radial", radialPattern],
	["scatter", scatterPattern],
	["unoverlap", unoverlapPattern],
	["grid", gridPattern],
]);

export function registerScatterPattern(name: string, pattern: ScatterPattern): () => void {
	PATTERNS.set(name, pattern);
	return () => {
		if (PATTERNS.get(name) === pattern) PATTERNS.delete(name);
	};
}

export function getScatterPattern(name: string): ScatterPattern | undefined {
	return PATTERNS.get(name);
}

export function listScatterPatterns(): string[] {
	return [...PATTERNS.keys()];
}
