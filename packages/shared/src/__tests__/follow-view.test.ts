import { afterEach, describe, expect, it, vi } from "vitest";
import { createFollowView, followView } from "../follow-view.js";
import type { Viewport } from "../types/geometry.js";
import type { BoardStore, ServiceRegistry, StoreEvent } from "../types/plugin.js";
import { worldToScreen } from "../utils/geometry.js";
import { type View3dApi, view3dService } from "../view-3d.js";

function services(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, value) {
			map.set(key, value);
			return () => map.delete(key);
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

function fakeStore(initial: Viewport = { x: 0, y: 0, zoom: 1, rotation: 0 }) {
	let vp = initial;
	const listeners = new Set<(e: StoreEvent) => void>();
	const store = {
		getViewport: () => vp,
		setViewport: (next: Viewport) => {
			vp = next;
			for (const l of [...listeners]) l({ type: "viewport:changed" } as StoreEvent);
		},
		onMutation: (l: (e: StoreEvent) => void) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
	} as unknown as BoardStore;
	return store;
}

function fakeView(amount: number) {
	let turn = 0;
	const heights: number[] = [];
	const api: View3dApi = {
		amount: () => amount,
		camera: () => ({ pitch: 0, yaw: 0, fov: 600, horizon: 0.45 }),
		setCameraHeight: (h) => heights.push(h),
		turn: () => turn,
		subscribe: () => () => {},
	};
	return { api, heights, setTurn: (t: number) => (turn = t) };
}

const ANCHOR = { x: 400, y: 300 };

describe("createFollowView", () => {
	it("pins the target to the anchor, turned to face up in the rotate mode", () => {
		const store = fakeStore();
		const f = createFollowView({ store, services: services() });
		f.step({ x: 120, y: -40, heading: 30 }, 1 / 60, { mode: "rotate", anchor: ANCHOR });
		const vp = store.getViewport();
		const at = worldToScreen(120, -40, vp);
		expect(at.x).toBeCloseTo(400);
		expect(at.y).toBeCloseTo(300);
		expect(vp.rotation).toBeCloseTo(-30);
	});

	it("eases toward the target from what is on screen", () => {
		const store = fakeStore();
		const f = createFollowView({ store, services: services() });
		const step = () =>
			f.step({ x: 100, y: 0 }, 1 / 60, { mode: "fixed", anchor: ANCHOR, smoothing: 0.5 });
		step();
		// Half way from the world point under the anchor (400, 300) to the target.
		const first = worldToScreen(100, 0, store.getViewport());
		expect(first.x).toBeCloseTo(400 - (400 - 100) / 2);
		step();
		const second = worldToScreen(100, 0, store.getViewport());
		expect(second.x).toBeGreaterThan(first.x);
		expect(second.x).toBeLessThan(400);
	});

	it("drives the 3D camera height only while the view is 3D, and lets go once", () => {
		const s = services();
		const view = fakeView(1);
		view3dService.provide(s, view.api);
		const f = createFollowView({ store: fakeStore(), services: s });
		const opts = { mode: "fixed" as const, anchor: ANCHOR };
		f.step({ x: 0, y: 0, z: 32 }, 1, opts);
		f.step({ x: 0, y: 0, z: 32 }, 1, opts);
		expect(view.heights.length).toBe(2);
		expect(view.heights[1]).toBeGreaterThan(view.heights[0] ?? 0);
		f.releaseHeight();
		f.releaseHeight();
		expect(view.heights.slice(2)).toEqual([0]);
		// `heightMargin: null` doesn't drive it at all.
		f.step({ x: 0, y: 0, z: 32 }, 1, { ...opts, heightMargin: null });
		expect(view.heights.length).toBe(3);
	});

	it("reads a pan as a pan, but not a zoom or the 3D view's own turn", () => {
		const s = services();
		const view = fakeView(1);
		view3dService.provide(s, view.api);
		const store = fakeStore();
		const f = createFollowView({ store, services: s });
		const pan = vi.fn();
		f.onPan(pan);
		f.step({ x: 0, y: 0 }, 1, { mode: "fixed", anchor: ANCHOR });
		expect(pan).not.toHaveBeenCalled();
		store.setViewport({ ...store.getViewport(), zoom: 2 });
		expect(pan).not.toHaveBeenCalled();
		view.setTurn(15);
		store.setViewport({ ...store.getViewport(), rotation: 15 });
		expect(pan).not.toHaveBeenCalled();
		store.setViewport({ ...store.getViewport(), x: 50 });
		expect(pan).toHaveBeenCalledTimes(1);
		f.dispose();
		store.setViewport({ ...store.getViewport(), x: 80 });
		expect(pan).toHaveBeenCalledTimes(1);
	});
});

describe("followView", () => {
	afterEach(() => vi.useRealTimers());

	it("follows on its own loop until stopped, or until the user pans", () => {
		vi.useFakeTimers();
		vi.stubGlobal("requestAnimationFrame", undefined);
		vi.stubGlobal("cancelAnimationFrame", undefined);
		const store = fakeStore();
		let target = { x: 10, y: 20 };
		const onPan = vi.fn();
		const stop = followView({ store, services: services() }, () => target, {
			mode: "fixed",
			anchor: () => ANCHOR,
			onPan,
		});
		vi.advanceTimersByTime(20);
		expect(worldToScreen(10, 20, store.getViewport()).x).toBeCloseTo(400);
		target = { x: 60, y: 20 };
		vi.advanceTimersByTime(20);
		expect(worldToScreen(60, 20, store.getViewport()).x).toBeCloseTo(400);
		store.setViewport({ ...store.getViewport(), x: 999 });
		expect(onPan).toHaveBeenCalledTimes(1);
		target = { x: 0, y: 0 };
		vi.advanceTimersByTime(50);
		expect(store.getViewport().x).toBe(999);
		stop();
		vi.unstubAllGlobals();
	});
});
