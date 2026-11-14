import { describe, expect, it, vi } from "vitest";
import {
	DEFAULT_VIEW3D_SHAPE_LIMITS,
	declaredView3dShapeTypes,
	sanitizeView3dShapeLimits,
	view3dShapeHeading,
	view3dShapeWallColor,
} from "../shape-view-3d-layout.js";
import type { ShapeData } from "../types/shape.js";

describe("shape-view-3d layout", () => {
	it("turns only a camera-facing stood-up shape toward the camera", () => {
		expect(view3dShapeHeading({ mode: "stand", facing: "camera" }, 30, 1, 90)).toBe(-90);
		expect(view3dShapeHeading({ mode: "stand", facing: "camera" }, 0, 0.5, 90)).toBe(-45);
		expect(view3dShapeHeading({ mode: "stand", facing: "fixed" }, 30, 1, 90)).toBe(30);
		expect(view3dShapeHeading({ mode: "box", facing: "camera" }, 30, 1, 90)).toBe(30);
	});

	it("reads a box's wall colour from its fill, else grey", () => {
		const s = (extra: object) => ({ style: {}, ...extra }) as unknown as ShapeData;
		expect(view3dShapeWallColor(s({ style: { fill: "#f00" } }))).toBe("#f00");
		expect(view3dShapeWallColor(s({ color: "#0f0" }))).toBe("#0f0");
		expect(view3dShapeWallColor(s({ style: { fill: "none" } }))).toBe("#9e9e9e");
	});

	it("sanitizes limits", () => {
		expect(sanitizeView3dShapeLimits({ minPx: -1, maxCount: 3.7 })).toEqual({
			...DEFAULT_VIEW3D_SHAPE_LIMITS,
			maxCount: 3,
		});
	});

	it("rebuilds the declared types only when a type registers or an override changes", () => {
		const defs = new Map<string, { view3d?: { modes: string[] } }>([
			["rect", { view3d: { modes: ["box"] } }],
			["text", {}],
		]);
		let notify = () => {};
		const onChange = vi.fn();
		const registry = {
			getAll: () => defs as never,
			subscribeView3d: (l: () => void) => {
				notify = l;
				return () => {
					notify = () => {};
				};
			},
		};
		const declared = declaredView3dShapeTypes(registry, onChange);
		const a = declared.get();
		expect(a).toEqual({ rect: { modes: ["box"] } });
		expect(declared.get()).toBe(a);
		notify();
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(declared.get()).not.toBe(a);
		declared.dispose();
	});
});
