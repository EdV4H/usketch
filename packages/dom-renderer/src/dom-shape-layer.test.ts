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
import { DomShapeLayer } from "./dom-shape-layer.js";

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

function ctx(viewportX: number, shapes: ShapeData[]): LayerRenderContext {
	return {
		viewport: { x: -viewportX, y: 0, zoom: 1 },
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
		const shapes = [shape("near", 0), shape("far-1", 5000), shape("far-2", 6000)];
		render(ctx(0, shapes));
		expect(container.querySelectorAll("[data-lod-id]")).toHaveLength(2);
		expect(simplifiedRenders).toBe(2);

		render(ctx(10, shapes));
		render(ctx(20, shapes));
		expect(simplifiedRenders).toBe(2);
	});

	it("re-renders only the off-screen shape whose data changed", () => {
		const shapes = [shape("near", 0), shape("far-1", 5000), shape("far-2", 6000)];
		render(ctx(0, shapes));
		expect(simplifiedRenders).toBe(2);

		const moved = shape("far-1", 5100);
		render(ctx(0, [shapes[0], moved, shapes[2]]));
		expect(simplifiedRenders).toBe(3);
		expect(container.querySelector('[data-lod-id="far-1"]')).not.toBeNull();
	});
});
