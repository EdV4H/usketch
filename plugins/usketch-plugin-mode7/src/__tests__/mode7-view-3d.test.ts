import { describe, expect, it } from "vitest";
import { createView3dApi } from "../mode7-service.js";
import {
	createMode7Store,
	DEFAULT_DEPTH_LAYER_IDS,
	DEFAULT_TILT_LAYER_IDS,
} from "../mode7-store.js";

describe("createView3dApi (view3dService)", () => {
	it("is flat while the view is off", () => {
		const api = createView3dApi(createMode7Store({ camera: { pitch: 55, yaw: 30 } }));
		expect(api.amount()).toBe(0);
		expect(api.camera()).toMatchObject({ pitch: 0, yaw: 0 });
	});

	it("hands out the drawn camera and notifies through the transition", () => {
		const store = createMode7Store({ camera: { pitch: 60, yaw: 40 } });
		const api = createView3dApi(store);
		let n = 0;
		api.subscribe(() => n++);
		store.setPresentation({ active: true, progress: 0.5, amount: 0.5, transitioning: true });
		expect(api.amount()).toBe(0.5);
		expect(api.camera()).toMatchObject({ pitch: 30, yaw: 20 });
		store.setActive(true);
		expect(api.camera()).toMatchObject({ pitch: 60, yaw: 40 });
		expect(n).toBe(2);
	});

	it("raises the camera: heightPx = height × zoom × amount", () => {
		const store = createMode7Store({ active: true });
		let zoom = 2;
		const api = createView3dApi(store, () => zoom);
		let n = 0;
		api.subscribe(() => n++);
		expect(api.camera().heightPx).toBe(0);
		api.setCameraHeight?.(120);
		expect(store.getState().camera.height).toBe(120);
		expect(api.camera().heightPx).toBe(240);
		zoom = 0.5;
		expect(api.camera().heightPx).toBe(60);
		store.setPresentation({ active: true, progress: 0.5, amount: 0.5, transitioning: true });
		expect(api.camera().heightPx).toBe(30);
		// A change too small to see doesn't notify; back to 0 always does.
		api.setCameraHeight?.(120.001);
		expect(n).toBe(2);
		api.setCameraHeight?.(0);
		expect(store.getState().camera.height).toBe(0);
		expect(n).toBe(3);
		api.setCameraHeight?.(Number.NaN);
		expect(store.getState().camera.height).toBe(0);
		expect(n).toBe(3);
	});
});

describe("default layers", () => {
	it("tilts the 3D shape layer and gives it depth", () => {
		expect(DEFAULT_TILT_LAYER_IDS).toContain("shape-3d");
		expect(DEFAULT_DEPTH_LAYER_IDS).toContain("shape-3d");
	});
});
