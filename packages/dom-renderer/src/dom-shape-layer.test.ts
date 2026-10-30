// @vitest-environment jsdom
import type {
	LayerRenderContext,
	ShapeData,
	ShapeDefinition,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cullRegion, DomShapeLayer } from "./dom-shape-layer.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let simplifiedRenders = 0;
function CountingSimplified({ shape }: { shape: ShapeData }) {
	simplifiedRenders++;
	return createElement("div", { "data-lod-id": shape.id });
}

const registry: ShapeRegistry = {
	register() {},
	get: (type) =>
		type === "box"
			? ({
					type: "box",
					render: () => createElement("rect"),
					simplifiedComponent: CountingSimplified,
				} as unknown as ShapeDefinition)
			: undefined,
	getAll: () => new Map(),
};

const shape = (id: string, x: number): ShapeData =>
	({ id, type: "box", x, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0 }) as ShapeData;

function ctx(viewportX: number, shapes: ShapeData[], zoom = 1): LayerRenderContext {
	return {
		viewport: { x: -viewportX * zoom, y: 0, zoom },
		shapes: new Map(shapes.map((s) => [s.id, s])),
		shapesSorted: shapes,
		selection: new Set(),
		hoveredShapeId: null,
		theme: {} as LayerRenderContext["theme"],
		renderMode: "interactive",
		viewportBounds: { x: viewportX, y: 0, width: 800, height: 600 },
	};
}

describe("DomShapeLayer viewport LOD", () => {
	let container: HTMLDivElement;
	let root: Root;
	const render = (c: LayerRenderContext) =>
		act(() => root.render(createElement(DomShapeLayer, { ctx: c, shapeRegistry: registry })));

	beforeEach(() => {
		simplifiedRenders = 0;
		container = document.createElement("div");
		root = createRoot(container);
	});
	afterEach(() => {
		act(() => root.unmount());
	});

	it("does not re-render off-screen shapes when only the viewport moves", () => {
		const shapes = [shape("near", 0), shape("far-1", 900), shape("far-2", 1000)];
		render(ctx(0, shapes));
		expect(container.querySelectorAll("[data-lod-id]")).toHaveLength(2);
		expect(simplifiedRenders).toBe(2);

		render(ctx(10, shapes));
		render(ctx(20, shapes));
		expect(simplifiedRenders).toBe(2);
	});

	it("re-renders only the off-screen shape whose data changed", () => {
		const shapes = [shape("near", 0), shape("far-1", 900), shape("far-2", 1000)];
		render(ctx(0, shapes));
		expect(simplifiedRenders).toBe(2);

		const moved = shape("far-1", 950);
		render(ctx(0, [shapes[0], moved, shapes[2]]));
		expect(simplifiedRenders).toBe(3);
		expect(container.querySelector('[data-lod-id="far-1"]')).not.toBeNull();
	});

	it("does not mount shapes beyond the cull region", () => {
		const shapes = [shape("near", 0), shape("band", 900), shape("gone", 5000)];
		render(ctx(0, shapes));
		expect(container.querySelector('[data-shape-id="near"]')).not.toBeNull();
		expect(container.querySelector('[data-lod-id="band"]')).not.toBeNull();
		expect(container.querySelector('[data-lod-id="gone"]')).toBeNull();
		expect(container.querySelector('[data-shape-id="gone"]')).toBeNull();

		// Panning to it brings it back.
		render(ctx(4800, shapes));
		expect(container.querySelector('[data-shape-id="gone"]')).not.toBeNull();
		expect(container.querySelector('[data-lod-id="near"]')).toBeNull();
	});

	it("keeps shapes inside the overscan pad drawn (3D view)", () => {
		const shapes = [shape("near", 0), shape("far", 1500)];
		const renderPad = (padPx: number) =>
			act(() =>
				root.render(
					createElement(DomShapeLayer, {
						ctx: ctx(0, shapes),
						shapeRegistry: registry,
						cullPadPx: padPx,
					}),
				),
			);
		renderPad(0);
		expect(container.querySelector('[data-lod-id="far"]')).toBeNull();
		renderPad(400);
		expect(container.querySelector('[data-lod-id="far"]')).not.toBeNull();
	});

	it("draws everything when viewport LOD is off", () => {
		const shapes = [shape("near", 0), shape("gone", 5000)];
		act(() =>
			root.render(
				createElement(DomShapeLayer, {
					ctx: ctx(0, shapes),
					shapeRegistry: registry,
					viewportLod: false,
				}),
			),
		);
		expect(container.querySelector('[data-shape-id="gone"]')).not.toBeNull();
	});
});

describe("cullRegion", () => {
	it("scales the viewport about its center and pads it in world units", () => {
		expect(cullRegion({ x: 0, y: 0, width: 800, height: 600 }, 2, 0, 1)).toEqual({
			x: -400,
			y: -300,
			width: 1600,
			height: 1200,
		});
		expect(cullRegion({ x: 0, y: 0, width: 800, height: 600 }, 1, 100, 2)).toEqual({
			x: -50,
			y: -50,
			width: 900,
			height: 700,
		});
	});

	it("is null while the canvas is unmeasured", () => {
		expect(cullRegion({ x: 0, y: 0, width: 0, height: 0 }, 2, 0, 1)).toBeNull();
	});
});
