import {
	createActionRegistry,
	createCommandRegistry,
	createEventBus,
	createShapeRegistry,
	createToolRegistry,
} from "@edv4h/usketch-core";
import type { CanvasPointerEvent, PluginContext, ToolContext } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type BasicShapePluginOptions, createBasicShapePlugin } from "../plugin.js";

function harness(opts?: BasicShapePluginOptions) {
	const store = createBoardStore();
	const ctx = {
		store,
		shapes: createShapeRegistry(),
		tools: createToolRegistry(),
		actions: createActionRegistry(),
		commands: createCommandRegistry(),
		events: createEventBus(),
		layers: { register: () => () => {} },
	} as unknown as PluginContext;
	createBasicShapePlugin(opts).setup(ctx);
	const tool = ctx.tools.get("basic-shape-draw");
	if (!tool) throw new Error("tool not registered");
	const toolCtx = ctx as unknown as ToolContext;
	const at = (x: number, y: number) => ({ worldPoint: { x, y } }) as unknown as CanvasPointerEvent;
	const shapes = () => [...store.getShapes().values()];
	return { ctx, store, tool, toolCtx, at, shapes };
}

// The label editor listens on window; the tests only drive the draw tool.
beforeEach(() => {
	vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
	vi.unstubAllGlobals();
});

describe("basic-shape-draw clickToPlace", () => {
	it("creates nothing on a click by default", () => {
		const { tool, toolCtx, at, shapes } = harness();
		tool.onPointerDown?.(toolCtx, at(100, 100));
		tool.onPointerUp?.(toolCtx, at(100, 100));
		expect(shapes()).toEqual([]);
	});

	it("places the default-size subtype centered on the click point when enabled", () => {
		const { ctx, store, tool, toolCtx, at, shapes } = harness({ clickToPlace: true });
		ctx.events.emit("basic-shape:select-subtype", { type: "ellipse" });
		tool.onPointerDown?.(toolCtx, at(100, 100));
		tool.onPointerUp?.(toolCtx, at(101, 101));
		const [shape] = shapes();
		expect(shape).toMatchObject({ type: "ellipse" });
		expect(shape.x + shape.width / 2).toBe(100);
		expect(shape.y + shape.height / 2).toBe(100);
		expect(shape.width).toBeGreaterThan(2);
		expect([...store.getSelection()]).toEqual([shape.id]);
	});

	it("still creates nothing on a thin drag along one axis", () => {
		const { tool, toolCtx, at, shapes } = harness({ clickToPlace: true });
		tool.onPointerDown?.(toolCtx, at(100, 100));
		tool.onPointerMove?.(toolCtx, at(200, 101));
		tool.onPointerUp?.(toolCtx, at(200, 101));
		expect(shapes()).toEqual([]);
	});

	it("keeps the drag start as the corner when dragging", () => {
		const { tool, toolCtx, at, shapes } = harness({ clickToPlace: true });
		tool.onPointerDown?.(toolCtx, at(100, 100));
		tool.onPointerMove?.(toolCtx, at(160, 140));
		tool.onPointerUp?.(toolCtx, at(160, 140));
		expect(shapes()[0]).toMatchObject({ x: 100, y: 100, width: 60, height: 40 });
	});
});
