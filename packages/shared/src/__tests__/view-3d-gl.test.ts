import { describe, expect, it, vi } from "vitest";
import type { ServiceRegistry } from "../types/plugin.js";
import {
	createView3dGl,
	VIEW3D_DEPTH_GLSL,
	VIEW3D_DEPTH_RANGE_PX,
	type View3dGlDrawable,
	view3dGl,
	view3dGlService,
} from "../view-3d-gl.js";

function fakeServices(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide: <T>(key: string, service: T) => {
			map.set(key, service);
			return () => {
				if (map.get(key) === service) map.delete(key);
			};
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key: string) => map.has(key),
	};
}

const drawable = (id: string, order?: number): View3dGlDrawable => ({
	id,
	order,
	draw: () => undefined,
});

describe("view3dGl (the GPU drawing hook)", () => {
	it("keeps the drawables in draw order (order, then registration)", () => {
		const gl = createView3dGl();
		const listener = vi.fn();
		gl.subscribe(listener);
		gl.register(drawable("late", 5));
		const offA = gl.register(drawable("a"));
		gl.register(drawable("first", -1));
		gl.register(drawable("b"));
		expect(gl.drawables().map((d) => d.id)).toEqual(["first", "a", "b", "late"]);
		expect(listener).toHaveBeenCalledTimes(4);
		offA();
		offA();
		expect(gl.drawables().map((d) => d.id)).toEqual(["first", "b", "late"]);
		expect(listener).toHaveBeenCalledTimes(5);
	});

	it("passes frame requests to the renderer and tells when it draws", () => {
		const gl = createView3dGl();
		const frames = vi.fn();
		const changes = vi.fn();
		const off = gl.onFrameRequest(frames);
		gl.subscribe(changes);
		gl.requestFrame();
		expect(frames).toHaveBeenCalledTimes(1);
		off();
		gl.requestFrame();
		expect(frames).toHaveBeenCalledTimes(1);
		expect(gl.isDrawing()).toBe(false);
		gl.setDrawing(true);
		gl.setDrawing(true);
		expect(gl.isDrawing()).toBe(true);
		expect(changes).toHaveBeenCalledTimes(1);
	});

	it("is one per board: created on first use, then shared", () => {
		const services = fakeServices();
		expect(view3dGlService.get(services)).toBeUndefined();
		const a = view3dGl(services);
		expect(view3dGl(services)).toBe(a);
		expect(view3dGlService.get(services)).toBe(a);
	});

	it("maps depth with the shared range", () => {
		expect(VIEW3D_DEPTH_GLSL).toContain(VIEW3D_DEPTH_RANGE_PX.toFixed(1));
	});
});
