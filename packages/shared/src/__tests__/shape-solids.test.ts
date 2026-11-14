import { describe, expect, it } from "vitest";
import { createShapeSolids, SHAPE_SOLIDS_PROVIDER_ID, shapeView3dAnchor } from "../shape-solids.js";
import type { ShapeTypeView3d } from "../shape-view-3d.js";
import type { ShapeData } from "../types/shape.js";

const box = (id: string, x: number, collision: string, extra: Record<string, unknown> = {}) =>
	({
		id,
		type: "rect",
		x,
		y: 0,
		width: 100,
		height: 100,
		style: {},
		view3d: { mode: "box", height: 40, collision },
		...extra,
	}) as unknown as ShapeData;

const ALL: ShapeTypeView3d = { modes: ["stand", "box", "float"] };

describe("shape solids", () => {
	it("answers walls and platform tops from the shapes' view3d", () => {
		let shapes = new Map([
			["w", box("w", 0, "solid")],
			["p", box("p", 200, "platform")],
		]);
		const solids = createShapeSolids({
			shapes: () => shapes,
			typeView3d: () => ALL,
			groundAt: () => 10,
		});
		expect(solids.provider.id).toBe(SHAPE_SOLIDS_PROVIDER_ID);
		expect(solids.provider.kind).toBe("solid");
		expect(solids.heightAt(50, 50)).toBe(Infinity);
		expect(solids.heightAt(250, 50)).toBe(50); // ground 10 + height 40
		expect(solids.heightAt(150, 50)).toBeNull();
		// A new shapes map (a change) rebuilds the index.
		shapes = new Map([["p", box("p", 200, "platform")]]);
		expect(solids.heightAt(50, 50)).toBeNull();
	});

	it("blocks only in 3D when told so", () => {
		let amount = 0;
		const shapes = new Map([["w", box("w", 0, "solid")]]);
		const solids = createShapeSolids({
			shapes: () => shapes,
			typeView3d: () => ALL,
			groundAt: () => 0,
			view3dAmount: () => amount,
		});
		solids.setIn3dOnly(true);
		expect(solids.heightAt(50, 50)).toBeNull();
		amount = 0.5;
		expect(solids.heightAt(50, 50)).toBe(Infinity);
	});

	it("reads the type settings it is given, rebuilding when their version changes", () => {
		const shapes = new Map([["w", box("w", 0, "solid")]]);
		const solids = createShapeSolids({
			shapes: () => shapes,
			typeView3d: () => undefined, // no declaration: box isn't allowed
			groundAt: () => 0,
		});
		expect(solids.heightAt(50, 50)).toBeNull();
		let table: ShapeTypeView3d = ALL;
		solids.setTypeView3d(
			() => table,
			() => table,
		);
		expect(solids.heightAt(50, 50)).toBe(Infinity);
		table = { modes: [] };
		expect(solids.heightAt(50, 50)).toBeNull();
		solids.setTypeView3d(null);
		expect(solids.heightAt(50, 50)).toBeNull();
	});

	it("places a stood-up shape by its foot and others by their centre", () => {
		const s = box("s", 0, "none");
		expect(shapeView3dAnchor(s, "stand")).toEqual({ x: 50, y: 100 });
		expect(shapeView3dAnchor(s, "box")).toEqual({ x: 50, y: 50 });
	});
});
