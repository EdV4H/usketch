// @vitest-environment jsdom
import {
	type Layer,
	type LayerRenderContext,
	type PluginContext,
	type ServiceRegistry,
	type ShapeData,
	type ShapeDefinition,
	type ShapeTypeView3d,
	shapeClaims,
	type View3dApi,
	view3dService,
} from "@edv4h/usketch-shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	css3dShapeSourceService,
	sanitizeCss3dShapeLimits,
	setupCss3dShapes,
} from "../css3d-shapes.js";
import { SHAPE_3D_LAYER_ID } from "../shapes-layer.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function fakeCtx(view3d: Record<string, ShapeTypeView3d | undefined>) {
	const layers = new Map<string, Layer>();
	const defs = new Map<string, ShapeDefinition>(
		Object.entries(view3d).map(([type, v]) => [
			type,
			{ render: () => <i data-drawn={type} />, view3d: v } as unknown as ShapeDefinition,
		]),
	);
	const ctx = {
		layers: {
			register: (l: Layer) => layers.set(l.id, l),
			unregister: (id: string) => layers.delete(id),
			getLayers: () => [...layers.values()],
		},
		events: { on: () => () => {}, emit: () => {} },
		shapes: { get: (t: string) => defs.get(t), getAll: () => defs, register() {} },
		services: services(),
	} as unknown as PluginContext;
	return { ctx, layers };
}

const shape = (id: string, type: string, extra: Record<string, unknown> = {}): ShapeData =>
	({ id, type, x: 0, y: 0, width: 40, height: 20, style: {}, ...extra }) as unknown as ShapeData;

const rc = (shapes: ShapeData[]): LayerRenderContext =>
	({
		viewport: { x: 0, y: 0, zoom: 1 },
		shapes: new Map(shapes.map((s) => [s.id, s])),
		shapesSorted: shapes,
		selection: new Set(),
		renderMode: "interactive",
		viewportBounds: { x: 0, y: 0, width: 500, height: 500 },
	}) as unknown as LayerRenderContext;

function provideView(ctx: PluginContext, amount: number): void {
	const api: View3dApi = {
		amount: () => amount,
		camera: () => ({ pitch: 60, yaw: 0, fov: 600, horizon: 0.45 }),
		subscribe: () => () => {},
	};
	view3dService.provide(ctx.services, api);
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
	host = document.createElement("div");
	document.body.appendChild(host);
	root = createRoot(host);
});
afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

/** Let the tracker attach to the view (it looks after setup, in a microtask). */
const settle = () => act(async () => {});

describe("the renderer's 3D shapes", () => {
	it("stands up the shapes their type allows, and claims them from the flat layer", async () => {
		const { ctx, layers } = fakeCtx({ rect: { modes: ["stand"] }, embed: { modes: [] } });
		provideView(ctx, 1);
		const dispose = setupCss3dShapes(ctx);
		await settle();
		const layer = layers.get(SHAPE_3D_LAYER_ID);
		expect(layer).toMatchObject({ view3d: "depth", order: 51, fixed: true });
		const shapes = [
			shape("a", "rect", { view3d: { mode: "stand" } }),
			shape("b", "embed", { view3d: { mode: "stand" } }),
		];
		await act(async () => root.render(layer?.render(rc(shapes)) ?? null));
		expect(host.querySelector('[data-shape-3d-id="a"]')).not.toBeNull();
		expect(host.querySelector('[data-shape-3d-id="b"]')).toBeNull();
		expect([...(shapeClaims(ctx.services).claimed() ?? [])]).toEqual(["a"]);

		dispose();
		expect(layers.has(SHAPE_3D_LAYER_ID)).toBe(false);
		expect(shapeClaims(ctx.services).claimed()).toBeUndefined();
	});

	it("releases its claims when its layer is replaced, and leaves the new one on teardown", async () => {
		const { ctx, layers } = fakeCtx({ rect: { modes: ["stand"] } });
		provideView(ctx, 1);
		const dispose = setupCss3dShapes(ctx);
		await settle();
		const shapes = [shape("a", "rect", { view3d: { mode: "stand" } })];
		await act(async () => root.render(layers.get(SHAPE_3D_LAYER_ID)?.render(rc(shapes)) ?? null));
		expect(shapeClaims(ctx.services).claimed()?.has("a")).toBe(true);
		// An older shape-3d plugin registers its own layer under the same id.
		const other: Layer = { id: SHAPE_3D_LAYER_ID, order: 51, render: () => null };
		ctx.layers.register(other);
		await act(async () => root.render(null));
		expect(shapeClaims(ctx.services).claimed()).toBeUndefined();
		dispose();
		expect(layers.get(SHAPE_3D_LAYER_ID)).toBe(other);
	});

	it("draws by a plugin's source when there is one", async () => {
		const { ctx, layers } = fakeCtx({ rect: undefined });
		provideView(ctx, 1);
		setupCss3dShapes(ctx);
		await settle();
		const shapes = [shape("a", "rect", { view3d: { mode: "box" } })];
		const draw = () =>
			act(async () => root.render(layers.get(SHAPE_3D_LAYER_ID)?.render(rc(shapes)) ?? null));
		await draw();
		// Undeclared types get the stand / float modes only.
		expect(host.querySelector('[data-shape-3d-id="a"]')).toBeNull();
		css3dShapeSourceService.provide(ctx.services, {
			types: () => ({ rect: { modes: ["box"] } }),
			limits: () => ({ maxCount: 0 }),
		});
		await draw();
		expect(host.querySelector('[data-shape-3d-id="a"]')).toBeNull();
		css3dShapeSourceService.provide(ctx.services, { types: () => ({ rect: { modes: ["box"] } }) });
		await draw();
		expect(host.querySelector('[data-shape-3d-id="a"]')?.getAttribute("data-shape-3d-mode")).toBe(
			"box",
		);
	});

	it("falls back to the default for an unusable limit", () => {
		expect(sanitizeCss3dShapeLimits({ minPx: -1, maxCount: 3.7, groundFlat: false })).toEqual({
			minPx: 8,
			maxCount: 3,
			groundFlat: false,
		});
	});
});
