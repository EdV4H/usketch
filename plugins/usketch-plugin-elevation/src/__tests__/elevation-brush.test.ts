import { describe, expect, it } from "vitest";
import {
	applyDab,
	beginStroke,
	DEFAULT_BRUSH,
	dabsAlong,
	falloffWeight,
	normalizeBrush,
	RAISE_RATE,
	strokeChanges,
} from "../elevation-brush.js";
import { DEFAULT_GEN, makeFieldShape, normalizeField } from "../elevation-field.js";
import { type ElevationModel, elevationSampler } from "../elevation-model.js";

const flatModel = (): ElevationModel => ({
	field: normalizeField(makeFieldShape("f")),
	chunks: new Map(),
});
const height = (m: ElevationModel, x: number, y: number) => elevationSampler(m).heightAt(x, y);
const brush = (patch: Partial<typeof DEFAULT_BRUSH> = {}) =>
	normalizeBrush({ ...DEFAULT_BRUSH, ...patch });

describe("brush settings", () => {
	it("keeps values in range and replaces junk", () => {
		expect(normalizeBrush({ mode: "nope", radius: 1e9, strength: "50", falloff: 3 })).toEqual({
			...DEFAULT_BRUSH,
			radius: 1024,
			strength: 50,
		});
		expect(normalizeBrush({ flattenHeight: -7 }).flattenHeight).toBe(-1);
	});

	it("falloff is 1 at the centre and 0 at the edge", () => {
		for (const f of ["smooth", "linear", "flat"] as const) {
			expect(falloffWeight(0, f)).toBe(1);
			expect(falloffWeight(1, f)).toBe(0);
		}
		expect(falloffWeight(0.5, "linear")).toBe(0.5);
		expect(falloffWeight(0.5, "smooth")).toBe(0.5);
		expect(falloffWeight(0.9, "flat")).toBe(1);
	});
});

describe("dabs", () => {
	it("raise lifts the centre by strength × rate × time, and nothing past the radius", () => {
		const stroke = beginStroke(flatModel());
		const settings = brush({ radius: 64, strength: 50 });
		expect(applyDab(stroke, 0, 0, { settings, dt: 0.5 })).toBe(true);
		expect(height(stroke.model, 0, 0)).toBeCloseTo(50 * RAISE_RATE * 0.5, 3);
		expect(height(stroke.model, 80, 0)).toBe(0);
		expect(height(stroke.model, 32, 0)).toBeGreaterThan(0);
		expect(height(stroke.model, 32, 0)).toBeLessThan(height(stroke.model, 0, 0));
	});

	it("never changes the arrays of an earlier model (the layer keys tiles on them)", () => {
		const stroke = beginStroke(flatModel());
		const settings = brush({ radius: 64 });
		applyDab(stroke, 0, 0, { settings, dt: 0.1 });
		const first = stroke.model;
		const before = Array.from(first.chunks.get("0,0") ?? []);
		applyDab(stroke, 0, 0, { settings, dt: 0.1 });
		expect(stroke.model).not.toBe(first);
		expect(Array.from(first.chunks.get("0,0") ?? [])).toEqual(before);
	});

	it("lower stops at 0", () => {
		const stroke = beginStroke(flatModel());
		applyDab(stroke, 0, 0, { settings: brush({ mode: "lower" }), dt: 1 });
		expect(height(stroke.model, 0, 0)).toBe(0);
		expect(strokeChanges(stroke)).toEqual([]); // flat stays flat: nothing to write
	});

	it("flatten pulls towards the target, smooth towards the neighbours' mean", () => {
		const stroke = beginStroke(flatModel());
		applyDab(stroke, 0, 0, {
			settings: brush({ radius: 32, strength: 100, falloff: "flat" }),
			dt: 0.25,
		});
		const peak = height(stroke.model, 0, 0);
		applyDab(stroke, 0, 0, {
			settings: brush({ mode: "flatten", radius: 64, strength: 100, falloff: "flat" }),
			target: 10,
			dt: 2,
		});
		expect(height(stroke.model, 0, 0)).toBeCloseTo(10, 1);
		expect(height(stroke.model, 48, 0)).toBeCloseTo(10, 1);

		const s2 = beginStroke(flatModel());
		applyDab(s2, 0, 0, { settings: brush({ radius: 16, falloff: "flat" }), dt: 1 });
		const spike = height(s2.model, 0, 0);
		applyDab(s2, 0, 0, { settings: brush({ mode: "smooth", radius: 64, strength: 100 }), dt: 0.5 });
		expect(height(s2.model, 0, 0)).toBeLessThan(spike);
		expect(height(s2.model, 16, 0)).toBeGreaterThan(0); // spread to the neighbour
		expect(peak).toBeGreaterThan(10);
	});

	it("terrace rounds heights to the step", () => {
		const stroke = beginStroke(flatModel());
		applyDab(stroke, 0, 0, { settings: brush({ radius: 32, falloff: "flat" }), dt: 0.07 }); // ~11
		applyDab(stroke, 0, 0, {
			settings: brush({ mode: "terrace", radius: 32, strength: 100, terraceStep: 16 }),
			dt: 3,
		});
		expect(height(stroke.model, 0, 0)).toBeCloseTo(16, 1);
	});

	it("works over generated terrain: the deltas are what the brush added", () => {
		const field = normalizeField(makeFieldShape("f", { seed: 5, gen: DEFAULT_GEN }));
		const model: ElevationModel = { field, chunks: new Map() };
		const h0 = height(model, 100, 100);
		const stroke = beginStroke(model);
		applyDab(stroke, 100, 100, { settings: brush({ radius: 64, falloff: "flat" }), dt: 0.25 });
		expect(height(stroke.model, 100, 100)).toBeCloseTo(h0 + 40 * RAISE_RATE * 0.25, 1);
	});
});

describe("dabsAlong", () => {
	it("spaces dabs a quarter radius apart and splits the time", () => {
		const dabs = dabsAlong({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.4, 40);
		expect(dabs).toHaveLength(10);
		expect(dabs.at(-1)).toEqual({ x: 100, y: 0, dt: 0.04 });
		expect(dabsAlong({ x: 5, y: 5 }, { x: 5, y: 5 }, 0.1, 40)).toEqual([{ x: 5, y: 5, dt: 0.1 }]);
	});
});

describe("strokeChanges", () => {
	it("lists touched chunks rounded to quarter units, and a chunk back to zero as null", () => {
		const base = flatModel();
		const stroke = beginStroke(base);
		// Across the corner of four chunks (512 units each).
		applyDab(stroke, 512, 512, { settings: brush({ radius: 64 }), dt: 0.2 });
		const changes = strokeChanges(stroke);
		expect(changes.map((c) => `${c.cx},${c.cy}`)).toEqual(["0,0", "1,0", "0,1", "1,1"]);
		for (const c of changes) expect(c.values).toBeInstanceOf(Int16Array);

		// Start from the result and dig it out again: every chunk becomes null.
		const stored: ElevationModel = {
			field: base.field,
			chunks: new Map(changes.map((c) => [`${c.cx},${c.cy}`, c.values as Int16Array])),
		};
		const back = beginStroke(stored);
		applyDab(back, 512, 512, { settings: brush({ mode: "lower", radius: 96 }), dt: 5 });
		expect(strokeChanges(back).map((c) => c.values)).toEqual([null, null, null, null]);
	});

	it("a board without a field draws on a new flat one", () => {
		const stroke = beginStroke(null);
		expect(stroke.createsField).toBe(true);
		expect(stroke.field.seed).toBeNull();
	});
});
