import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	availableModes,
	DEFAULT_SHAPE_3D_TYPES,
	effectiveCollision,
	mergeShape3dTypes,
	normalizeShape3d,
	resolveShape3d,
	SHAPE_3D_KEY,
	storedShape3d,
} from "../shape-3d-params.js";

const shape = (type: string, extra: Record<string, unknown> = {}): ShapeData =>
	({ id: "s", type, x: 0, y: 0, width: 10, height: 10, style: {}, ...extra }) as ShapeData;

describe("normalizeShape3d", () => {
	it("fills defaults", () => {
		expect(normalizeShape3d({ mode: "stand" })).toEqual({
			mode: "stand",
			height: 0,
			facing: "camera",
			ground: true,
			shadow: true,
			collision: "none",
		});
	});
	it("keeps valid fields and drops invalid / unknown ones", () => {
		expect(
			normalizeShape3d({ mode: "stand", facing: "fixed", ground: false, shadow: "no", junk: 1 }),
		).toEqual({
			mode: "stand",
			height: 0,
			facing: "fixed",
			ground: false,
			shadow: true,
			collision: "none",
		});
		expect(normalizeShape3d({ mode: "stand", facing: "sideways" })?.facing).toBe("camera");
	});
	it("gives box and float their default height, and clamps a given one", () => {
		expect(normalizeShape3d({ mode: "box" })?.height).toBe(16);
		expect(normalizeShape3d({ mode: "float" })?.height).toBe(24);
		expect(normalizeShape3d({ mode: "box", height: 40 })?.height).toBe(40);
		expect(normalizeShape3d({ mode: "box", height: -5 })?.height).toBe(0);
		expect(normalizeShape3d({ mode: "box", height: 1e9 })?.height).toBe(2000);
		expect(normalizeShape3d({ mode: "float", height: Number.NaN })?.height).toBe(24);
		expect(normalizeShape3d({ mode: "float", height: "8" })?.height).toBe(24);
	});
	it("is null without a usable mode", () => {
		expect(normalizeShape3d(undefined)).toBeNull();
		expect(normalizeShape3d("stand")).toBeNull();
		expect(normalizeShape3d({})).toBeNull();
		expect(normalizeShape3d({ mode: "spin" })).toBeNull();
	});
});

describe("collision", () => {
	it("keeps a valid collision and drops an unknown one", () => {
		expect(normalizeShape3d({ mode: "box", collision: "platform" })?.collision).toBe("platform");
		expect(normalizeShape3d({ mode: "box", collision: "bouncy" })?.collision).toBe("none");
		expect(storedShape3d({ mode: "stand", collision: "solid" })?.collision).toBe("solid");
	});
	it("only allows what the mode can have", () => {
		expect(effectiveCollision({ mode: "box", collision: "platform" })).toBe("platform");
		expect(effectiveCollision({ mode: "box", collision: "solid" })).toBe("solid");
		// A stood-up plane has no top: a platform becomes a wall.
		expect(effectiveCollision({ mode: "stand", collision: "platform" })).toBe("solid");
		expect(effectiveCollision({ mode: "stand", collision: "solid" })).toBe("solid");
		// A floating shape hangs above the ground.
		expect(effectiveCollision({ mode: "float", collision: "solid" })).toBe("none");
		expect(effectiveCollision({ mode: "float", collision: "platform" })).toBe("none");
	});
});

describe("per-type config", () => {
	it("keeps embeds and generated UI flat by default", () => {
		expect(availableModes(DEFAULT_SHAPE_3D_TYPES, "embed")).toEqual([]);
		expect(availableModes(DEFAULT_SHAPE_3D_TYPES, "openui")).toEqual([]);
	});
	it("lets only box-like types be a box", () => {
		expect(availableModes(DEFAULT_SHAPE_3D_TYPES, "ellipse")).toEqual(["stand", "float"]);
		for (const type of ["rectangle", "rounded-rect", "sticky", "card", "frame", "image"]) {
			expect(availableModes(DEFAULT_SHAPE_3D_TYPES, type)).toEqual(["stand", "box", "float"]);
		}
	});
	it("merges host settings over the built-in ones per type", () => {
		const types = mergeShape3dTypes(DEFAULT_SHAPE_3D_TYPES, {
			embed: { modes: ["stand"] },
			portal: { default: { mode: "stand" } },
		});
		expect(availableModes(types, "embed")).toEqual(["stand"]);
		expect(types.portal?.default).toEqual({ mode: "stand" });
		expect(types.openui?.modes).toEqual([]);
	});
});

describe("resolveShape3d", () => {
	it("uses the shape's own parameters", () => {
		const s = shape("rect", { [SHAPE_3D_KEY]: { mode: "stand", facing: "fixed" } });
		expect(resolveShape3d(s, {})?.facing).toBe("fixed");
	});
	it("falls back to the type default (object or function)", () => {
		expect(resolveShape3d(shape("portal"), { portal: { default: { mode: "stand" } } })?.mode).toBe(
			"stand",
		);
		const byShape = {
			portal: { default: (s: ShapeData) => (s.width > 5 ? { mode: "stand" } : null) },
		};
		expect(resolveShape3d(shape("portal"), byShape)).not.toBeNull();
		expect(resolveShape3d(shape("portal", { width: 1 }), byShape)).toBeNull();
	});
	it("is null when the type doesn't allow the mode", () => {
		const s = shape("embed", { [SHAPE_3D_KEY]: { mode: "stand" } });
		expect(resolveShape3d(s, DEFAULT_SHAPE_3D_TYPES)).toBeNull();
	});
	it("is null for a flat shape", () => {
		expect(resolveShape3d(shape("rect"), {})).toBeNull();
	});
});

describe("storedShape3d", () => {
	it("keeps a given height but not a defaulted one", () => {
		expect(storedShape3d({ mode: "box" })).toEqual({
			mode: "box",
			facing: "camera",
			ground: true,
			shadow: true,
			collision: "none",
		});
		expect(storedShape3d({ mode: "box", height: 40, junk: 1 })?.height).toBe(40);
		expect(storedShape3d({ mode: "nope" })).toBeNull();
	});
});
