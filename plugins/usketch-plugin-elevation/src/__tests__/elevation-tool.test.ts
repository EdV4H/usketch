import { createCommandRegistry } from "@edv4h/usketch-core";
import type { CanvasPointerEvent, ToolContext } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { type BrushSettings, DEFAULT_BRUSH } from "../elevation-brush.js";
import type { StrokePreview } from "../elevation-layer.js";
import { elevationHeightAt, elevationSampler } from "../elevation-model.js";
import { editedChunkCount } from "../elevation-ops.js";
import { type BrushCursor, createElevationToolDefinition } from "../elevation-tool.js";
import { createReactiveStore } from "../reactive-store.js";
import { fakeStore } from "./helpers.js";

function harness(brush: Partial<BrushSettings> = {}) {
	const store = fakeStore();
	const commands = createCommandRegistry();
	const ctx = { store, commands } as unknown as ToolContext;
	const brushStore = createReactiveStore<BrushSettings>({ ...DEFAULT_BRUSH, ...brush });
	const preview = createReactiveStore<StrokePreview>({ model: null });
	const cursor = createReactiveStore<BrushCursor>({ x: 0, y: 0, visible: false });
	let time = 0;
	let pending: (() => void) | null = null;
	const tool = createElevationToolDefinition({
		brush: brushStore,
		preview,
		cursor,
		now: () => time,
		requestFrame: (cb) => {
			pending = cb;
			return 1;
		},
		cancelFrame: () => {
			pending = null;
		},
	});
	const frame = (ms: number) => {
		time += ms;
		const cb = pending;
		pending = null;
		cb?.();
	};
	const ev = (x: number, y: number, mods: Partial<CanvasPointerEvent> = {}) =>
		({
			worldPoint: { x, y },
			screenPoint: { x, y },
			shiftKey: false,
			ctrlKey: false,
			metaKey: false,
			altKey: false,
			button: 0,
			...mods,
		}) as CanvasPointerEvent;
	return { store, commands, ctx, tool, frame, ev, preview, cursor, brush: brushStore };
}

describe("elevation tool", () => {
	it("draws the stroke as a preview and writes it once, on release, as one undo step", () => {
		const h = harness({ radius: 64, strength: 50 });
		h.tool.onPointerDown?.(h.ctx, h.ev(256, 256));
		expect(h.preview.get().model).not.toBeNull();
		expect(h.store.getShapes().size).toBe(0); // nothing written while drawing
		h.frame(100);
		h.tool.onPointerMove?.(h.ctx, h.ev(400, 256));
		h.frame(100);
		const previewed = h.preview.get().model;
		expect(previewed && elevationSampler(previewed).heightAt(400, 256)).toBeGreaterThan(0);
		h.tool.onPointerUp?.(h.ctx, h.ev(400, 256));
		expect(h.preview.get().model).toBeNull();
		expect(editedChunkCount(h.store)).toBe(1);
		expect(elevationHeightAt(h.store, 400, 256)).toBeGreaterThan(0);
		h.commands.undo();
		expect(h.store.getShapes().size).toBe(0);
	});

	it("keeps raising while the pointer stands still", () => {
		const h = harness({ radius: 64, strength: 50 });
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0));
		const centre = (m: StrokePreview["model"]) => (m ? elevationSampler(m).heightAt(0, 0) : 0);
		const first = centre(h.preview.get().model);
		for (let k = 0; k < 5; k++) h.frame(100); // a frame counts for at most 0.1 s
		expect(centre(h.preview.get().model)).toBeGreaterThan(first + 50);
		h.tool.onPointerUp?.(h.ctx, h.ev(0, 0));
	});

	it("Shift swaps raise for lower", () => {
		const h = harness({ radius: 64 });
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0));
		for (let k = 0; k < 5; k++) h.frame(100);
		h.tool.onPointerUp?.(h.ctx, h.ev(0, 0));
		const top = elevationHeightAt(h.store, 0, 0);
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0, { shiftKey: true }));
		h.frame(100);
		h.tool.onPointerUp?.(h.ctx, h.ev(0, 0));
		expect(elevationHeightAt(h.store, 0, 0)).toBeLessThan(top);
	});

	it("Alt + click in flatten picks the height instead of painting", () => {
		const h = harness({ radius: 64 });
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0));
		h.frame(250);
		h.tool.onPointerUp?.(h.ctx, h.ev(0, 0));
		const top = elevationHeightAt(h.store, 0, 0);
		h.brush.set({ mode: "flatten" });
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0, { altKey: true }));
		expect(h.brush.get().flattenHeight).toBeCloseTo(top, 0);
		expect(h.preview.get().model).toBeNull();
	});

	it("switching tools mid-stroke drops it", () => {
		const h = harness();
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0));
		h.frame(100);
		h.tool.onDeactivate?.(h.ctx);
		expect(h.preview.get().model).toBeNull();
		expect(h.store.getShapes().size).toBe(0);
		expect(h.cursor.get().visible).toBe(false);
	});

	it("ignores buttons other than the main one", () => {
		const h = harness();
		h.tool.onPointerDown?.(h.ctx, h.ev(0, 0, { button: 2 }));
		expect(h.preview.get().model).toBeNull();
	});
});
