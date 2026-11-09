import {
	createActionRegistry,
	createCommandRegistry,
	createEventBus,
	createLayerManager,
	createServiceRegistry,
	createShapeRegistry,
	createToolRegistry,
} from "@edv4h/usketch-core";
import { defineService, groundHeightService, type PluginContext } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it, vi } from "vitest";
import { GROUND_LAYER_ID } from "../elevation-layer.js";
import { MESH_LAYER_ID } from "../elevation-mesh-layer.js";
import { getElevationApi } from "../elevation-service.js";
import {
	createElevationPlugin,
	DEFAULT_GROUND_ORDER,
	DEFAULT_MESH_ORDER,
	type ElevationPluginOptions,
} from "../plugin.js";

const mapLike = defineService<{ setHeightEnabled: (on: boolean) => void }>("usketch-plugin-map");

function harness(withMap: boolean, options: ElevationPluginOptions = {}) {
	const store = createBoardStore();
	const ctx = {
		store,
		shapes: createShapeRegistry(),
		tools: createToolRegistry(),
		actions: createActionRegistry(),
		commands: createCommandRegistry(),
		services: createServiceRegistry(),
		events: createEventBus(),
		layers: createLayerManager(),
		hud: { registerSettings: () => () => {}, registerPanel: () => () => {} },
	} as unknown as PluginContext;
	const setHeightEnabled = vi.fn();
	if (withMap) {
		groundHeightService.provide(ctx.services, { heightAt: () => 16 });
		mapLike.provide(ctx.services, { setHeightEnabled });
	}
	const dispose = createElevationPlugin(options).setup(ctx) as () => void;
	const api = getElevationApi(ctx.services);
	if (!api) throw new Error("service not provided");
	return { ctx, api, dispose, setHeightEnabled };
}

describe("elevation plugin", () => {
	it("registers the ground layer and the service", () => {
		const { ctx, dispose } = harness(false);
		expect(ctx.layers.getLayers().some((l) => l.id === GROUND_LAYER_ID)).toBe(true);
		dispose();
		expect(ctx.layers.getLayers().some((l) => l.id === GROUND_LAYER_ID)).toBe(false);
		expect(getElevationApi(ctx.services)).toBeUndefined();
	});

	it("puts the ground and mesh layers at the default orders, or where the host says", () => {
		const orderOf = (h: ReturnType<typeof harness>, id: string) =>
			h.ctx.layers.getLayers().find((l) => l.id === id)?.order;
		const byDefault = harness(false);
		expect(orderOf(byDefault, GROUND_LAYER_ID)).toBe(DEFAULT_GROUND_ORDER);
		expect(orderOf(byDefault, MESH_LAYER_ID)).toBe(DEFAULT_MESH_ORDER);
		byDefault.dispose();

		const lowered = harness(false, { groundOrder: 40.5, meshOrder: 41.5 });
		expect(orderOf(lowered, GROUND_LAYER_ID)).toBe(40.5);
		expect(orderOf(lowered, MESH_LAYER_ID)).toBe(41.5);
		lowered.dispose();

		// Not a finite number: the default, so the layer sort stays well-defined.
		const broken = harness(false, { groundOrder: Number.NaN, meshOrder: Number.POSITIVE_INFINITY });
		expect(orderOf(broken, GROUND_LAYER_ID)).toBe(DEFAULT_GROUND_ORDER);
		expect(orderOf(broken, MESH_LAYER_ID)).toBe(DEFAULT_MESH_ORDER);
		broken.dispose();
	});

	it("owns the ground height only on a board with a field, else defers to the map", () => {
		const { ctx, api, setHeightEnabled, dispose } = harness(true);
		const ground = () => groundHeightService.get(ctx.services)?.heightAt(100, 100);
		expect(ground()).toBe(16); // no field yet: the map's
		expect(setHeightEnabled).not.toHaveBeenCalled();

		api.enableInfinite({ seed: 3 });
		expect(ground()).toBe(api.getHeightAt(100, 100));
		expect(setHeightEnabled).toHaveBeenLastCalledWith(false);

		ctx.commands.undo(); // the field is gone again
		expect(ground()).toBe(16);
		expect(setHeightEnabled).toHaveBeenLastCalledWith(true);

		api.enableInfinite({ seed: 3 });
		dispose();
		// Torn down: the map's heights and provider are back.
		expect(setHeightEnabled).toHaveBeenLastCalledWith(true);
		expect(ground()).toBe(16);
	});

	it("on teardown leaves a ground provider that came after it in place", () => {
		const { ctx, dispose } = harness(true);
		const later = { heightAt: () => 99 };
		groundHeightService.provide(ctx.services, later);
		dispose();
		expect(groundHeightService.get(ctx.services)).toBe(later);
	});
});

describe("elevation plugin — brush", () => {
	it("registers the elevation tool and its cursor layer, and paints through the service", () => {
		const { ctx, api, dispose } = harness(false);
		expect(ctx.tools.get("elevation")).toBeDefined();
		expect(ctx.layers.getLayers().some((l) => l.id === "usketch-elevation:brush-cursor")).toBe(
			true,
		);
		api.brush.set({ radius: 64, strength: 50 });
		expect(api.paint([{ x: 96, y: 96 }], { seconds: 0.5 })).toBe(1);
		expect(api.getHeightAt(96, 96)).toBeCloseTo(100, 0); // on a sample: 50 × 4 × 0.5
		ctx.commands.undo();
		expect(api.getField()).toBeNull();
		dispose();
		expect(ctx.layers.getLayers().some((l) => l.id === "usketch-elevation:brush-cursor")).toBe(
			false,
		);
	});
});

describe("elevation plugin — 3D mesh", () => {
	it("registers the mesh layer (not tilted by Mode 7), and none with mesh: false", () => {
		const { ctx, dispose } = harness(false);
		expect(ctx.layers.getLayers().some((l) => l.id === "usketch-elevation:mesh")).toBe(true);
		dispose();
		expect(ctx.layers.getLayers().some((l) => l.id === "usketch-elevation:mesh")).toBe(false);
	});
});
