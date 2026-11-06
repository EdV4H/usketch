import type { PluginContext } from "@edv4h/usketch-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResolver } from "../edge-pan-config.js";
import { setupEdgePan } from "../edge-pan-runtime.js";

function harness() {
	const handlers = new Map<string, (payload: unknown) => void>();
	const frames: (() => void)[] = [];
	const resizeListeners = new Set<() => void>();
	const querySelectorAll = vi.fn(() => [
		{ getBoundingClientRect: () => ({ width: 1000, height: 800 }) },
	]);
	vi.stubGlobal("document", { querySelectorAll });
	vi.stubGlobal("window", {
		addEventListener: (_: string, fn: () => void) => resizeListeners.add(fn),
		removeEventListener: (_: string, fn: () => void) => resizeListeners.delete(fn),
	});
	vi.stubGlobal("requestAnimationFrame", (fn: () => void) => frames.push(fn));
	vi.stubGlobal("cancelAnimationFrame", () => {});
	const viewport = { x: 0, y: 0, zoom: 1 };
	const ctx = {
		events: {
			on: (name: string, fn: (payload: unknown) => void) => {
				handlers.set(name, fn);
				return () => handlers.delete(name);
			},
		},
		store: {
			updateShape: () => {},
			getShape: () => undefined,
			getSelection: () => new Set(["a"]),
			getViewport: () => ({ ...viewport }),
			panBy: (dx: number, dy: number) => {
				viewport.x += dx;
				viewport.y += dy;
			},
		},
	} as unknown as PluginContext;
	const teardown = setupEdgePan(ctx, createResolver({}, {}));
	const emit = (name: string, payload?: unknown) => handlers.get(name)?.(payload);
	const runFrames = (n: number) => {
		for (let i = 0; i < n; i++) frames.shift()?.();
	};
	const drag = (x: number, y: number) => {
		emit("canvas:pointerdown", { screenPoint: { x, y } });
		emit("shape:updated", { id: "a" });
	};
	const resize = () => {
		for (const fn of resizeListeners) fn();
	};
	return { emit, runFrames, drag, resize, querySelectorAll, viewport, teardown, resizeListeners };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("setupEdgePan", () => {
	it("ドラッグ中の canvas サイズはドラッグごとに 1 回だけ測る", () => {
		const h = harness();
		h.drag(990, 400); // 右端の帯の中
		h.runFrames(10);
		expect(h.querySelectorAll).toHaveBeenCalledTimes(1);
		expect(h.viewport.x).toBeLessThan(0); // 右端なので左へパンし続ける

		h.emit("canvas:pointerup");
		h.drag(500, 400);
		h.runFrames(5);
		expect(h.querySelectorAll).toHaveBeenCalledTimes(2);
		h.teardown();
	});

	it("window の resize で測り直し、teardown で listener を外す", () => {
		const h = harness();
		h.drag(500, 400);
		h.runFrames(3);
		h.resize();
		h.runFrames(3);
		expect(h.querySelectorAll).toHaveBeenCalledTimes(2);
		h.teardown();
		expect(h.resizeListeners.size).toBe(0);
	});
});
