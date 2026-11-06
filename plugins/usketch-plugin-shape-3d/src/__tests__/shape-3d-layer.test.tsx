// @vitest-environment jsdom
import type {
	LayerRenderContext,
	ShapeData,
	ShapeDefinition,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Shape3dLayer } from "../shape-3d-layer.js";
import { DEFAULT_SHAPE_3D_LIMITS } from "../shape-3d-layout.js";
import { SHAPE_3D_KEY } from "../shape-3d-params.js";
import { crossRender3d, type Shape3dRenderContext } from "../shape-3d-render3d.js";
import type { View3dSnapshot, View3dTracker } from "../view-3d-tracker.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const registry: ShapeRegistry = {
	register() {},
	get: (type) =>
		type === "rect"
			? ({ render: () => <rect data-drawn="" /> } as unknown as ShapeDefinition)
			: undefined,
	getAll: () => new Map(),
};

function tracker(initial: View3dSnapshot): View3dTracker & { set(s: View3dSnapshot): void } {
	let snap = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => snap,
		subscribe: (l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		dispose() {},
		set(s) {
			snap = s;
			for (const l of listeners) l();
		},
	};
}

const shape = (id: string, extra: Record<string, unknown> = {}): ShapeData =>
	({
		id,
		type: "rect",
		x: 0,
		y: 0,
		width: 40,
		height: 20,
		style: {},
		[SHAPE_3D_KEY]: { mode: "stand" },
		...extra,
	}) as unknown as ShapeData;

const rc = (shapes: ShapeData[]): LayerRenderContext =>
	({
		viewport: { x: 0, y: 0, zoom: 1 },
		shapes: new Map(shapes.map((s) => [s.id, s])),
		shapesSorted: shapes,
		selection: new Set(),
		renderMode: "interactive",
		viewportBounds: { x: 0, y: 0, width: 500, height: 500 },
	}) as unknown as LayerRenderContext;

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

describe("Shape3dLayer", () => {
	it("draws nothing while flat, and stands the 3D shapes up when the view rises", () => {
		const t = tracker({ amount: 0, yaw: 0 });
		const onDrawn = vi.fn();
		const shapes = [shape("a"), shape("flat", { [SHAPE_3D_KEY]: undefined })];
		act(() =>
			root.render(
				<Shape3dLayer
					rc={rc(shapes)}
					shapes={registry}
					tracker={t}
					types={{}}
					limits={DEFAULT_SHAPE_3D_LIMITS}
					overscanPx={0}
					heightAt={() => 16}
					onDrawn={onDrawn}
				/>,
			),
		);
		expect(host.querySelector("[data-shape-3d-id]")).toBeNull();
		expect(onDrawn).toHaveBeenLastCalledWith(new Set());

		act(() => t.set({ amount: 1, yaw: 0 }));
		const node = host.querySelector<HTMLElement>('[data-shape-3d-id="a"]');
		expect(node).not.toBeNull();
		expect(node?.style.transform).toBe("translateZ(16px) rotateX(-90deg)");
		expect(node?.querySelector("[data-drawn]")).not.toBeNull();
		expect(host.querySelector('[data-shape-3d-shadow="a"]')).not.toBeNull();
		expect(host.querySelector('[data-shape-3d-id="flat"]')).toBeNull();
		expect(onDrawn).toHaveBeenLastCalledWith(new Set(["a"]));
	});

	it("leaves out the shadow when it is off", () => {
		const t = tracker({ amount: 1, yaw: 0 });
		act(() =>
			root.render(
				<Shape3dLayer
					rc={rc([shape("a", { [SHAPE_3D_KEY]: { mode: "stand", shadow: false } })])}
					shapes={registry}
					tracker={t}
					types={{}}
					limits={DEFAULT_SHAPE_3D_LIMITS}
					overscanPx={0}
					heightAt={() => 0}
					onDrawn={() => {}}
				/>,
			),
		);
		expect(host.querySelector('[data-shape-3d-id="a"]')).not.toBeNull();
		expect(host.querySelector("[data-shape-3d-shadow]")).toBeNull();
	});

	it("draws a type's own render3d in a node lifted to the ground, or falls back on null", () => {
		const seen: Shape3dRenderContext[] = [];
		const types = {
			rect: {
				render3d: (sh: ShapeData, ctx: Shape3dRenderContext) => {
					seen.push(ctx);
					return sh.id === "own" ? <i data-own="" /> : null;
				},
			},
		};
		const t = tracker({ amount: 1, yaw: 90 });
		act(() =>
			root.render(
				<Shape3dLayer
					rc={rc([shape("own"), shape("generic", { x: 100 })])}
					shapes={registry}
					tracker={t}
					types={types}
					limits={DEFAULT_SHAPE_3D_LIMITS}
					overscanPx={0}
					heightAt={() => 16}
					onDrawn={() => {}}
					camera={{
						get: () => ({ pitch: 60, yaw: 90, fov: 800, horizon: 0.5 }),
						subscribe: () => () => {},
					}}
				/>,
			),
		);
		const own = host.querySelector<HTMLElement>('[data-shape-3d-id="own"]');
		expect(own?.getAttribute("data-shape-3d-mode")).toBe("custom");
		expect(own?.style.transform).toBe("translateZ(16px)");
		expect(own?.querySelector("[data-own]")).not.toBeNull();
		const generic = host.querySelector<HTMLElement>('[data-shape-3d-id="generic"]');
		expect(generic?.getAttribute("data-shape-3d-mode")).toBe("stand");
		const ctx = seen[0];
		expect(ctx).toMatchObject({ amount: 1, zoom: 1, width: 40, height: 20, faceCamera: -90 });
		expect(ctx?.camera()?.pitch).toBe(60);
	});

	it("crossRender3d stands two crossed planes, and leaves other modes generic", () => {
		const ctx = {
			params: { mode: "stand" },
			amount: 0.5,
			content: <b data-content="" />,
		} as unknown as Shape3dRenderContext;
		act(() => root.render(crossRender3d(shape("a"), ctx)));
		const planes = [...host.querySelectorAll<HTMLElement>("[data-shape-3d-plane]")];
		expect(planes.map((p) => p.style.transform)).toEqual([
			"rotateZ(0deg) rotateX(-45deg)",
			"rotateZ(45deg) rotateX(-45deg)",
		]);
		expect(host.querySelectorAll("[data-content]").length).toBe(2);
		expect(
			crossRender3d(shape("a"), { ...ctx, params: { mode: "box" } } as Shape3dRenderContext),
		).toBeNull();
	});
});
