import { createGroundDecalRegistry, type GroundDecalArea } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	DECAL_MARGIN,
	DECAL_MAX_PX,
	DECAL_MIN_PX,
	decalTexMapping,
	decalTilePx,
	paintDecalTile,
	projectedTilePx,
	tileWorldRect,
} from "../elevation-decals.js";

/** A 2D context that records the calls the painter cares about. */
function fakeCtx() {
	const calls: string[] = [];
	let transform: number[] = [1, 0, 0, 1, 0, 0];
	const ctx = {
		setTransform: (...m: number[]) => {
			transform = m;
			calls.push(`setTransform(${m.join(",")})`);
		},
		clearRect: (...r: number[]) => calls.push(`clearRect(${r.join(",")})`),
		save: () => calls.push("save"),
		restore: () => calls.push("restore"),
		beginPath: () => {},
		rect: (...r: number[]) => calls.push(`rect(${r.join(",")})`),
		clip: () => calls.push("clip"),
		get transform() {
			return transform;
		},
	};
	return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, raw: ctx };
}

describe("decalTilePx", () => {
	it("is a power of two about the tile's screen size, within the limits", () => {
		expect(decalTilePx(10)).toBe(DECAL_MIN_PX);
		expect(decalTilePx(200)).toBe(256);
		expect(decalTilePx(500)).toBe(512);
		expect(decalTilePx(100_000)).toBe(DECAL_MAX_PX);
		expect(decalTilePx(Number.POSITIVE_INFINITY)).toBe(DECAL_MAX_PX);
		expect(decalTilePx(2000, 512)).toBe(512);
	});
});

describe("tileWorldRect / decalTexMapping", () => {
	it("maps a tile's local coordinates onto its bitmap inside the margin", () => {
		expect(tileWorldRect(1, -2, 512)).toEqual({ left: 512, top: -1024, right: 1024, bottom: -512 });
		const { scale, offset } = decalTexMapping(512, 256);
		const full = 256 + 2 * DECAL_MARGIN;
		// The tile's corners land on the first / last texel edges inside the margin.
		expect(0 * scale + offset).toBeCloseTo(DECAL_MARGIN / full, 9);
		expect(512 * scale + offset).toBeCloseTo((DECAL_MARGIN + 256) / full, 9);
	});
});

describe("projectedTilePx", () => {
	const vp = { x: 0, y: 0, zoom: 1 };
	const size = { width: 1280, height: 800 };
	it("is the tile's size on a flat view, smaller far away under a tilt, huge right under the eye", () => {
		const flat = { pitch: 0, yaw: 0, fov: 600, horizon: 0.45 };
		expect(projectedTilePx(tileWorldRect(0, 0, 512), 0, vp, flat, size)).toBeCloseTo(512, 6);
		const tilted = { ...flat, pitch: 60 };
		const near = projectedTilePx(tileWorldRect(1, 1, 512), 0, vp, tilted, size);
		const far = projectedTilePx(tileWorldRect(1, -6, 512), 0, vp, tilted, size);
		expect(far).toBeLessThan(near);
		const eye = projectedTilePx(tileWorldRect(0, 40, 512), 0, vp, { ...tilted, fov: 300 }, size);
		expect(eye).toBe(Number.POSITIVE_INFINITY);
	});
});

describe("paintDecalTile", () => {
	it("clears, then paints each decal there in world units, clipped to the tile + margin", () => {
		const decals = createGroundDecalRegistry();
		const areas: GroundDecalArea[] = [];
		const seen: number[][] = [];
		const { ctx, calls, raw } = fakeCtx();
		decals.set("course", {
			paint: (_c, area) => {
				areas.push(area);
				seen.push(raw.transform);
			},
			bounds: () => ({ left: 0, top: 0, right: 600, bottom: 600 }),
		});
		decals.set("elsewhere", {
			paint: () => {
				throw new Error("must not be called");
			},
			bounds: () => ({ left: 5000, top: 5000, right: 6000, bottom: 6000 }),
		});
		const n = paintDecalTile(ctx, decals, "3d", tileWorldRect(0, 0, 512), 256);
		expect(n).toBe(1);
		const full = 256 + 2 * DECAL_MARGIN;
		expect(calls[1]).toBe(`clearRect(0,0,${full},${full})`);
		// 256 px over 512 units: 0.5 px per unit, the world origin DECAL_MARGIN px in.
		expect(seen[0]).toEqual([0.5, 0, 0, 0.5, DECAL_MARGIN, DECAL_MARGIN]);
		const m = DECAL_MARGIN / 0.5;
		expect(areas[0]).toEqual({
			rect: { left: -m, top: -m, right: 512 + m, bottom: 512 + m },
			pxPerUnit: 0.5,
			view: "3d",
		});
		expect(calls).toContain(`rect(${-m},${-m},${512 + 2 * m},${512 + 2 * m})`);
		expect(calls).toContain("clip");
	});

	it("skips decals of the other view, and keeps going past one that throws", () => {
		const decals = createGroundDecalRegistry();
		const painted: string[] = [];
		decals.set("a-broken", {
			paint: () => {
				throw new Error("boom");
			},
		});
		decals.set("b-flat-only", { paint: () => painted.push("flat"), views: ["flat"] });
		decals.set("c-ok", { paint: () => painted.push("ok") });
		const { ctx, calls } = fakeCtx();
		expect(paintDecalTile(ctx, decals, "3d", tileWorldRect(0, 0, 512), 64)).toBe(1);
		expect(painted).toEqual(["ok"]);
		// Every save is restored, even around the decal that threw.
		expect(calls.filter((c) => c === "save").length).toBe(
			calls.filter((c) => c === "restore").length,
		);
	});
});
