import type { BoundingBox } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { gridPattern, radialPattern, scatterPattern, unoverlapPattern } from "../patterns.js";
import { hashSeed, mulberry32 } from "../rng.js";
import type { PatternContext, Placement } from "../types.js";

const overlaps = (a: BoundingBox, b: BoundingBox) =>
	a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

/** N uniform items + a pattern context centred at (500,500). */
function ctx(n: number, opts: Partial<PatternContext> = {}): PatternContext {
	const items = Array.from({ length: n }, (_, i) => ({
		key: `k${i}`,
		bounds: { x: 0, y: 0, width: 40, height: 40 },
	}));
	return {
		seedBounds: { x: 480, y: 480, width: 40, height: 40 },
		seedCenter: { x: 500, y: 500 },
		items,
		occupied: [],
		spacing: 20,
		rng: mulberry32(hashSeed("test")),
		...opts,
	};
}

/** Turn placements back into boxes (uniform 40×40) to check overlaps. */
const boxes = (ps: Placement[]): BoundingBox[] =>
	ps.map((p) => ({ x: p.x, y: p.y, width: 40, height: 40 }));

function noneOverlap(ps: Placement[]): boolean {
	const bs = boxes(ps);
	for (let i = 0; i < bs.length; i++)
		for (let j = i + 1; j < bs.length; j++) if (overlaps(bs[i], bs[j])) return false;
	return true;
}

describe("radialPattern", () => {
	it("places every item, evenly on a ring, non-overlapping", () => {
		const ps = radialPattern(ctx(6));
		expect(ps).toHaveLength(6);
		expect(noneOverlap(ps)).toBe(true);
		// centres are equidistant from the seed centre (a ring).
		const radii = ps.map((p) => Math.hypot(p.x + 20 - 500, p.y + 20 - 500));
		for (const r of radii) expect(Math.abs(r - radii[0])).toBeLessThan(1e-6);
	});
});

describe("gridPattern", () => {
	it("lays items in a square-ish grid, non-overlapping", () => {
		const ps = gridPattern(ctx(4));
		expect(ps).toHaveLength(4);
		expect(noneOverlap(ps)).toBe(true);
		const cols = new Set(ps.map((p) => Math.round(p.x))).size;
		expect(cols).toBe(2); // ceil(sqrt(4)) = 2 columns
	});
});

describe("unoverlapPattern", () => {
	it("avoids the occupied set and each other", () => {
		const occupied: BoundingBox[] = [{ x: 460, y: 460, width: 80, height: 80 }]; // seed blob
		const ps = unoverlapPattern(ctx(5, { occupied }));
		expect(ps).toHaveLength(5);
		expect(noneOverlap(ps)).toBe(true);
		for (const b of boxes(ps)) expect(overlaps(b, occupied[0])).toBe(false);
	});
});

describe("scatterPattern", () => {
	it("is deterministic for a fixed seed and varies for another", () => {
		const a = scatterPattern(ctx(5, { rng: mulberry32(hashSeed("A")) }));
		const a2 = scatterPattern(ctx(5, { rng: mulberry32(hashSeed("A")) }));
		const b = scatterPattern(ctx(5, { rng: mulberry32(hashSeed("B")) }));
		expect(a).toEqual(a2);
		expect(a).not.toEqual(b);
		expect(a).toHaveLength(5);
		expect(a.some((p) => p.rotation !== undefined)).toBe(true);
	});
});
