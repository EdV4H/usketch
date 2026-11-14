// @vitest-environment jsdom
import {
	createView3dCell,
	type Layer,
	type PluginContext,
	type ServiceRegistry,
	view3dGlService,
	view3dOcclusionService,
	view3dRendererService,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	createGpu3dRendererPlugin,
	drawnCamera,
	GPU_STAGE_ATTR,
	GPU3D_LAYER_ID,
	gpu3dRendererService,
	hiddenLayerRules,
	setupGpu3dRenderer,
} from "../gpu3d-renderer.js";

function services(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, value) {
			map.set(key, value);
			return () => map.delete(key);
		},
		get: <T,>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

function fakeCtx() {
	const layers: Layer[] = [
		{ id: "bg-grid", order: 0, view3d: "tilt", render: () => null },
		{ id: "cliffs", order: 1, view3d: "depth", render: () => null },
		{ id: "terrain", order: 1, view3d: "ground", render: () => null },
		{ id: "hud", order: 9, fixed: true, render: () => null },
	];
	const view3d = createView3dCell();
	const ctx = {
		layers: {
			getLayers: () => layers,
			register: (l: Layer) => layers.push(l),
			unregister: (id: string) => {
				const i = layers.findIndex((l) => l.id === id);
				if (i >= 0) layers.splice(i, 1);
			},
		},
		events: { on: () => () => {}, emit: () => {} },
		shapes: { get: () => undefined, getAll: () => new Map() },
		store: {
			getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
			onMutation: () => () => {},
			getView3d: view3d.get,
			setView3d: view3d.set,
			subscribeView3d: view3d.subscribe,
		},
		services: services(),
	} as unknown as PluginContext;
	return { ctx, layers, view3d };
}

describe("drawnCamera", () => {
	it("scales the pitch and height by how far into 3D the view is", () => {
		const state = {
			amount: 0.5,
			camera: { pitch: 60, fov: 800, horizon: 0.4, height: 100 },
		} as unknown as Parameters<typeof drawnCamera>[0];
		expect(drawnCamera(state, 2)).toEqual({
			pitch: 30,
			yaw: 0,
			fov: 800,
			horizon: 0.4,
			heightPx: 100,
		});
		expect(drawnCamera({ ...state, amount: 3 }, Number.NaN).heightPx).toBe(100);
	});
});

describe("hiddenLayerRules", () => {
	it("hides the given layers only while the GPU stage is on", () => {
		const css = hiddenLayerRules(["a", 'b"c']);
		expect(css).toContain(
			`[${GPU_STAGE_ATTR}="on"]>[data-layer-id="a"]{visibility:hidden !important;}`,
		);
		expect(css).toContain('[data-layer-id="bc"]');
		expect(css).toContain('[data-view3d="hidden"]{display:none !important;}');
	});
});

describe("setupGpu3dRenderer", () => {
	it("needs a 3D view state", () => {
		const { ctx } = fakeCtx();
		(ctx.store as unknown as { getView3d?: unknown }).getView3d = undefined;
		expect(setupGpu3dRenderer(ctx)).toBeNull();
	});

	it("adds its canvas layer, reads the declared layers, takes overrides and cleans up", () => {
		const { ctx, layers } = fakeCtx();
		const r = setupGpu3dRenderer(ctx);
		expect(r).not.toBeNull();
		if (!r) return;
		const canvas = layers.find((l) => l.id === GPU3D_LAYER_ID);
		expect(canvas).toMatchObject({ fixed: true });
		expect(r.api.getTiltLayers()).toEqual(["bg-grid", "cliffs"]);
		expect(r.api.getDepthLayers()).toEqual(["cliffs"]);
		r.api.setTiltLayers(["only"]);
		r.api.setDepthLayers([]);
		expect(r.api.getTiltLayers()).toEqual(["only"]);
		expect(r.api.getDepthLayers()).toEqual([]);
		r.api.setTiltLayers(null);
		expect(r.api.getTiltLayers()).toEqual(["bg-grid", "cliffs"]);
		// No GL context here (jsdom): not drawing.
		expect(r.api.isDrawing()).toBe(false);
		expect(view3dGlService.get(ctx.services)?.isDrawing()).toBe(false);
		r.dispose();
		expect(layers.some((l) => l.id === GPU3D_LAYER_ID)).toBe(false);
	});

	it("answers what the ground hides unless another renderer does, and stops on dispose", () => {
		const { ctx } = fakeCtx();
		const r = setupGpu3dRenderer(ctx);
		const occlusion = view3dOcclusionService.get(ctx.services);
		expect(occlusion).toBeDefined();
		expect(occlusion?.look()).toBe("fade");
		// Not drawn yet (no stage size): nothing is hidden.
		expect(occlusion?.hidden(0, 0, 0)).toBe(false);
		r?.dispose();
		expect(view3dOcclusionService.get(ctx.services)).toBeUndefined();

		const other = fakeCtx();
		const existing = { hidden: () => true, look: () => "hide", subscribe: () => () => {} };
		view3dOcclusionService.provide(other.ctx.services, existing as never);
		setupGpu3dRenderer(other.ctx)?.dispose();
		expect(view3dOcclusionService.get(other.ctx.services)).toBe(existing);
	});
});

describe("createGpu3dRendererPlugin", () => {
	it("provides itself as the board's 3D renderer, and steps aside for one already there", () => {
		const { ctx } = fakeCtx();
		const teardown = createGpu3dRendererPlugin().setup(ctx) as () => void;
		const api = gpu3dRendererService.get(ctx.services);
		expect(api).toBeDefined();
		expect(view3dRendererService.get(ctx.services)).toBe(api);
		teardown();
		expect(view3dRendererService.get(ctx.services)).toBeUndefined();

		const other = fakeCtx();
		const existing = { isDrawing: () => false } as never;
		view3dRendererService.provide(other.ctx.services, existing);
		expect(createGpu3dRendererPlugin().setup(other.ctx)).toBeUndefined();
		expect(gpu3dRendererService.get(other.ctx.services)).toBeUndefined();
		expect(other.layers.some((l) => l.id === GPU3D_LAYER_ID)).toBe(false);
	});
});
