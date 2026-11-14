import { describe, expect, it } from "vitest";
import {
	LEGACY_SHAPE_VIEW_3D_KEY,
	readShapeView3d,
	resolveShapeView3d,
	shapeView3dCollision,
	shapeView3dPatch,
	storedShapeView3d,
} from "../shape-view-3d.js";
import type { ShapeData } from "../types/shape.js";

const shape = (extra: Partial<ShapeData> & Record<string, unknown> = {}): ShapeData =>
	({
		id: "s",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...extra,
	}) as ShapeData;

describe("shape view3d", () => {
	it("reads view3d, normalized with defaults", () => {
		expect(readShapeView3d(shape({ view3d: { mode: "box" } }))).toEqual({
			mode: "box",
			height: 16,
			facing: "camera",
			ground: true,
			shadow: true,
			collision: "none",
		});
		expect(readShapeView3d(shape())).toBeNull();
		expect(readShapeView3d(shape({ view3d: { mode: "spin" } }))).toBeNull();
	});

	it("reads the older key, and prefers it while a shape still has it", () => {
		expect(readShapeView3d(shape({ [LEGACY_SHAPE_VIEW_3D_KEY]: { mode: "float" } }))?.mode).toBe(
			"float",
		);
		// An older client only writes the older key: it is the newest.
		const both = shape({ view3d: { mode: "box" }, [LEGACY_SHAPE_VIEW_3D_KEY]: { mode: "stand" } });
		expect(readShapeView3d(both)?.mode).toBe("stand");
	});

	it("writes both keys, and clears both", () => {
		const stored = storedShapeView3d({ mode: "box", height: 40, extra: 1 });
		expect(stored).toEqual({
			mode: "box",
			height: 40,
			facing: "camera",
			ground: true,
			shadow: true,
			collision: "none",
		});
		expect(shapeView3dPatch(stored ?? undefined)).toEqual({
			view3d: stored,
			[LEGACY_SHAPE_VIEW_3D_KEY]: stored,
		});
		expect(shapeView3dPatch(undefined)).toEqual({
			view3d: undefined,
			[LEGACY_SHAPE_VIEW_3D_KEY]: undefined,
		});
		// No height given: kept out, so each mode takes its own default.
		expect(storedShapeView3d({ mode: "float" })).not.toHaveProperty("height");
	});

	it("resolves through the type: its default, and only its modes", () => {
		const portal = { modes: ["stand" as const], default: { mode: "stand" } };
		expect(resolveShapeView3d(shape({ type: "board-portal" }), portal)?.mode).toBe("stand");
		expect(resolveShapeView3d(shape({ view3d: { mode: "box" } }), portal)).toBeNull();
		expect(resolveShapeView3d(shape({ view3d: { mode: "stand" } }), { modes: [] })).toBeNull();
		// No declaration: stand and float only.
		expect(resolveShapeView3d(shape({ view3d: { mode: "box" } }), undefined)).toBeNull();
		expect(resolveShapeView3d(shape({ view3d: { mode: "float" } }), undefined)?.mode).toBe("float");
	});

	it("keeps only the collisions a mode can have", () => {
		expect(shapeView3dCollision({ mode: "box", collision: "platform" })).toBe("platform");
		expect(shapeView3dCollision({ mode: "stand", collision: "platform" })).toBe("solid");
		expect(shapeView3dCollision({ mode: "float", collision: "solid" })).toBe("none");
	});
});
