// @vitest-environment jsdom
import {
	type LayerRenderContext,
	LEGACY_SHAPE_VIEW_3D_KEY as SHAPE_3D_KEY,
	type ShapeView3dRenderContext as Shape3dRenderContext,
	type ShapeData,
	type ShapeDefinition,
	type ShapeRegistry,
	type View3dSnapshot,
	type View3dTracker,
} from "@edv4h/usketch-shared";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOcclusionCache, Css3dShapesLayer as Shape3dLayer } from "../shapes-layer.js";
import { DEFAULT_CSS3D_SHAPE_LIMITS as DEFAULT_SHAPE_3D_LIMITS } from "../shapes-layout.js";

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
		subscribeCamera: () => () => {},
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

describe("Css3dShapesLayer", () => {
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
		// A shape without 3D parameters lies flat on the raised ground (groundFlat).
		const flat = host.querySelector<HTMLElement>('[data-shape-3d-id="flat"]');
		expect(flat?.getAttribute("data-shape-3d-mode")).toBe("float");
		expect(flat?.style.transform).toBe("translateZ(16px)");
		expect(host.querySelector('[data-shape-3d-shadow="flat"]')).toBeNull();
		expect(onDrawn).toHaveBeenLastCalledWith(new Set(["a", "flat"]));
	});

	it("fades a shape whose top the ground hides, a box face by face, and re-renders on a change", () => {
		const t = tracker({ amount: 1, yaw: 0 });
		let hiddenIds = new Set(["a", "b"]);
		let look: "fade" | "hide" = "fade";
		const listeners = new Set<() => void>();
		let version = 0;
		const asked: number[] = [];
		const occlusion = {
			hidden: (x: number, _y: number, h: number) => {
				asked.push(h);
				return hiddenIds.has(x === 20 ? "a" : "b");
			},
			look: () => look,
			subscribe: (l: () => void) => {
				listeners.add(l);
				return () => listeners.delete(l);
			},
		};
		const changes = {
			get: () => version,
			subscribe: (l: () => void) =>
				occlusion.subscribe(() => {
					version++;
					l();
				}),
		};
		const shapes = [
			shape("a"),
			shape("b", { x: 100, [SHAPE_3D_KEY]: { mode: "box", height: 30 } }),
		];
		act(() =>
			root.render(
				<Shape3dLayer
					rc={rc(shapes)}
					shapes={registry}
					tracker={t}
					types={{ rect: { modes: ["stand", "box", "float"] } }}
					limits={DEFAULT_SHAPE_3D_LIMITS}
					overscanPx={0}
					heightAt={() => 10}
					onDrawn={() => {}}
					occlusion={occlusion}
					occlusionChanges={changes}
				/>,
			),
		);
		// Asked at the top: a stood-up shape's height, a box's height, on the ground.
		expect(asked).toEqual([30, 40]);
		const a = host.querySelector<HTMLElement>('[data-shape-3d-id="a"]');
		const b = host.querySelector<HTMLElement>('[data-shape-3d-id="b"]');
		expect(a?.style.opacity).toBe("0.3");
		expect(a?.hasAttribute("data-shape-3d-hidden")).toBe(true);
		expect(host.querySelector<HTMLElement>('[data-shape-3d-shadow="a"]')?.style.visibility).toBe(
			"hidden",
		);
		// The box keeps its 3D: its faces fade, not the node.
		expect(b?.style.opacity).toBe("");
		expect(b?.querySelector<HTMLElement>("[data-shape-3d-top]")?.style.opacity).toBe("0.3");
		expect(b?.querySelector<HTMLElement>("[data-shape-3d-wall]")?.style.opacity).toBe("0.3");

		act(() => {
			hiddenIds = new Set(["b"]);
			look = "hide";
			for (const l of listeners) l();
		});
		expect(a?.style.opacity).toBe("");
		expect(a?.hasAttribute("data-shape-3d-hidden")).toBe(false);
		expect(b?.style.visibility).toBe("hidden");
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
});

describe("occlusion cache", () => {
	it("reuses an answer while fresh, asks again when stale or moved, within a budget per frame", () => {
		const cache = createOcclusionCache(100, 2);
		const ask = vi.fn(() => true);
		cache.frame(0);
		expect(cache.get("a", "k", ask)).toBe(true);
		expect(cache.get("b", "k", ask)).toBe(true);
		// Over the budget: a shape not asked yet counts as in view.
		expect(cache.get("c", "k", ask)).toBe(false);
		expect(ask).toHaveBeenCalledTimes(2);
		cache.frame(50);
		expect(cache.get("a", "k", ask)).toBe(true);
		expect(ask).toHaveBeenCalledTimes(2);
		// Moved: asked again even though fresh.
		cache.get("a", "moved", () => false);
		expect(cache.get("a", "moved", ask)).toBe(false);
		cache.frame(200);
		cache.get("b", "k", ask);
		expect(ask).toHaveBeenCalledTimes(3);
		cache.clear();
		cache.frame(210);
		expect(cache.get("b", "k", () => false)).toBe(false);
	});
});
