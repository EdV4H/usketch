import { describe, expect, it } from "vitest";
import { encodeChunk } from "../elevation-codec.js";
import { DEFAULT_GEN, makeChunkShape, makeFieldShape, normalizeField } from "../elevation-field.js";
import { boardElevation, elevationSampler } from "../elevation-model.js";
import { DEFAULT_DISPLAY, heightColor, renderTilePixels, shadeFactor } from "../elevation-shade.js";
import { fakeStore } from "./helpers.js";

function samplerFor(seed: number | undefined, delta?: (li: number, lj: number) => number) {
	const field = makeFieldShape(
		"f",
		seed === undefined ? {} : { seed, gen: DEFAULT_GEN, waterLevel: 48 },
	);
	const shapes = [field];
	if (delta) {
		const v = new Int16Array(32 * 32);
		for (let lj = 0; lj < 32; lj++)
			for (let li = 0; li < 32; li++) v[lj * 32 + li] = delta(li, lj) * 4;
		shapes.push(makeChunkShape(normalizeField(field), 0, 0, encodeChunk(v)) as never);
	}
	return elevationSampler(boardElevation(fakeStore(shapes)) as never);
}

const alphaAt = (px: Uint8ClampedArray, size: number, x: number, y: number) =>
	px[(y * size + x) * 4 + 3];

describe("shadeFactor", () => {
	it("is 1 on flat ground, brighter facing the light (north-west), darker away", () => {
		expect(shadeFactor(0, 0)).toBeCloseTo(1, 10);
		expect(shadeFactor(0.5, 0.5)).toBeGreaterThan(1); // rises to the south-east: faces north-west
		expect(shadeFactor(-0.5, -0.5)).toBeLessThan(1);
	});
});

describe("heightColor", () => {
	it("is water below the water level and land above, snow on the peaks", () => {
		const [r, , b] = heightColor(10, 48, 320);
		expect(b).toBeGreaterThan(r);
		expect(heightColor(320, 48, 320)).toEqual([242, 242, 238]);
	});
});

describe("renderTilePixels", () => {
	it("leaves a flat board transparent and paints a hill on it", () => {
		const size = 32;
		const flat = renderTilePixels({
			sampler: samplerFor(undefined),
			level: 0,
			tx: 0,
			ty: 0,
			size,
			display: DEFAULT_DISPLAY,
		});
		expect(flat.every((v, i) => i % 4 !== 3 || v === 0)).toBe(true);
		const hill = renderTilePixels({
			sampler: samplerFor(undefined, (li, lj) =>
				Math.max(0, 80 - 10 * Math.hypot(li - 16, lj - 16)),
			),
			level: 0,
			tx: 0,
			ty: 0,
			size,
			display: DEFAULT_DISPLAY,
		});
		expect(alphaAt(hill, size, 16, 16)).toBe(255);
		expect(alphaAt(hill, size, 0, 0)).toBe(0);
	});

	it("covers the whole tile on a generated terrain", () => {
		const px = renderTilePixels({
			sampler: samplerFor(5),
			level: 1,
			tx: -2,
			ty: 3,
			size: 16,
			display: DEFAULT_DISPLAY,
		});
		for (let i = 3; i < px.length; i += 4) expect(px[i]).toBe(255);
	});

	it("draws contour lines only when asked", () => {
		const sampler = samplerFor(undefined, (li) => li * 10);
		const base = { sampler, level: 0, tx: 0, ty: 0, size: 64 };
		const without = renderTilePixels({ ...base, display: { ...DEFAULT_DISPLAY, contour: 0 } });
		const withLines = renderTilePixels({ ...base, display: { ...DEFAULT_DISPLAY, contour: 32 } });
		let darker = 0;
		for (let i = 0; i < without.length; i += 4) if (withLines[i] < without[i]) darker++;
		expect(darker).toBeGreaterThan(0);
	});
});
