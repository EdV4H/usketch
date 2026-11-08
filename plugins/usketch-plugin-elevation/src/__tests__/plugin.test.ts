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
import { getElevationApi } from "../elevation-service.js";
import { createElevationPlugin } from "../plugin.js";

const mapLike = defineService<{ setHeightEnabled: (on: boolean) => void }>("usketch-plugin-map");

function harness(withMap: boolean) {
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
	const dispose = createElevationPlugin().setup(ctx) as () => void;
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
});
