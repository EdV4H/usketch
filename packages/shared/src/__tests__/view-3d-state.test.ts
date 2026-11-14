import { describe, expect, it } from "vitest";
import {
	clampCamera3d,
	createView3dCell,
	DEFAULT_CAMERA_3D,
	FLAT_VIEW_3D,
	patchView3d,
	view3dCellOf,
	view3dOverscanPx,
} from "../view-3d-state.js";

describe("View3dState", () => {
	it("starts flat with the default camera", () => {
		expect(createView3dCell().get()).toEqual(FLAT_VIEW_3D);
		expect(FLAT_VIEW_3D.camera).toEqual(DEFAULT_CAMERA_3D);
	});

	it("clamps the camera and the amount", () => {
		expect(clampCamera3d({ pitch: 120, fov: 10, horizon: 2, height: Number.NaN })).toEqual({
			pitch: 85,
			fov: 200,
			horizon: 0.9,
			height: 0,
		});
		expect(patchView3d(FLAT_VIEW_3D, { amount: 3 }).amount).toBe(1);
		expect(patchView3d(FLAT_VIEW_3D, { amount: -1 }).amount).toBe(0);
	});

	it("merges camera patches and tells listeners only on a change", () => {
		const cell = createView3dCell();
		let n = 0;
		cell.subscribe(() => n++);
		cell.set({ camera: { height: 40 } });
		expect(cell.get().camera).toEqual({ ...DEFAULT_CAMERA_3D, height: 40 });
		cell.set({ camera: { height: 40 } });
		cell.set({});
		expect(n).toBe(1);
		const before = cell.get();
		cell.set({ amount: 0 });
		expect(cell.get()).toBe(before);
	});

	it("view3dCellOf is null for a store without the 3D view", () => {
		expect(view3dCellOf({})).toBeNull();
		const inner = createView3dCell();
		const cell = view3dCellOf({
			getView3d: () => inner.get(),
			setView3d: (p) => inner.set(p),
			subscribeView3d: (l) => inner.subscribe(l),
		});
		cell?.set({ amount: 0.5 });
		expect(inner.get().amount).toBe(0.5);
	});
});

describe("draw distance and overscan", () => {
	it("clamps the draw distance to >= 0", () => {
		expect(patchView3d(FLAT_VIEW_3D, { drawDistance: -5 }).drawDistance).toBe(0);
		expect(patchView3d(FLAT_VIEW_3D, { drawDistance: Number.NaN }).drawDistance).toBe(0);
		expect(patchView3d(FLAT_VIEW_3D, { drawDistance: 2400 }).drawDistance).toBe(2400);
	});

	it("overscans by the draw distance past the stage, only while in 3D", () => {
		const on = patchView3d(FLAT_VIEW_3D, { amount: 1, drawDistance: 1500 });
		expect(view3dOverscanPx(FLAT_VIEW_3D, 1, 800)).toBe(0); // flat
		expect(view3dOverscanPx(on, 1, 800)).toBe(700 + 16);
		expect(view3dOverscanPx(on, 0.5, 800)).toBe(0); // ends within the stage
		expect(view3dOverscanPx({ ...on, drawDistance: 0 }, 1, 800)).toBe(0); // clip to the box
		expect(view3dOverscanPx(on, 1, 0)).toBe(0); // not measured yet
	});
});
