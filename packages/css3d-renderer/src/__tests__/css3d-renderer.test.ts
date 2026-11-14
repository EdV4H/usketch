// @vitest-environment jsdom
import { createView3dCell, type Layer, type PluginContext } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	CAMERA_HEIGHT_VAR,
	cameraHeightPx,
	LEGACY_STAGE_ATTR,
	layerTransform,
	STAGE_ATTR,
	setupCss3dRenderer,
} from "../css3d-renderer.js";

const LAYERS: Layer[] = [
	{ id: "ground", order: 0, view3d: "tilt", render: () => null },
	{ id: "cliffs", order: 1, view3d: "depth", render: () => null },
	{ id: "hud", order: 2, fixed: true, render: () => null },
];

function fakeCtx(viewport = { x: 0, y: 0, zoom: 1 }) {
	const handlers = new Map<string, () => void>();
	const emitted: [string, unknown][] = [];
	const ctx = {
		layers: { getLayers: () => LAYERS },
		events: {
			on: (name: string, fn: () => void) => {
				handlers.set(name, fn);
				return () => handlers.delete(name);
			},
			emit: (name: string, data: unknown) => emitted.push([name, data]),
		},
		store: { getViewport: () => viewport, onMutation: () => () => {} },
		services: {},
	} as unknown as PluginContext;
	return { ctx, emitted, handlers };
}

function sheet(): string {
	return document.querySelector("style[data-css3d-renderer]")?.textContent ?? "";
}

describe("CSS 3D renderer", () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement("div");
		for (const l of LAYERS) {
			const el = document.createElement("div");
			el.setAttribute("data-layer-id", l.id);
			container.appendChild(el);
		}
		document.body.appendChild(container);
		vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
			width: 1280,
			height: 800,
		} as DOMRect);
	});

	afterEach(() => {
		container.remove();
		vi.restoreAllMocks();
	});

	it("draws only while the view is risen", () => {
		const view3d = createView3dCell();
		const { ctx } = fakeCtx();
		const r = setupCss3dRenderer(ctx, { view3d });
		expect(r).not.toBeNull();
		expect(container.hasAttribute(STAGE_ATTR)).toBe(false);
		view3d.set({ amount: 1, camera: { pitch: 60 } });
		expect(container.getAttribute(STAGE_ATTR)).toBe("on");
		expect(container.getAttribute(LEGACY_STAGE_ATTR)).toBe("on");
		const css = sheet();
		expect(css).toContain('[data-layer-id="ground"]{transform:perspective(600px) rotateX(60deg)');
		// The tilt layer is clipped, the depth layer keeps its depth instead.
		expect(css).toMatch(/\[data-layer-id="ground"\]\{[^}]*clip-path/);
		expect(css).not.toMatch(/\[data-layer-id="cliffs"\]\{[^}]*clip-path/);
		expect(css).toContain('[data-layer-id="cliffs"]>div');
		expect(css).not.toContain('"hud"');
		expect(css).toContain('[data-view3d="hidden"]{display:none');
		view3d.set({ amount: 0 });
		expect(container.hasAttribute(STAGE_ATTR)).toBe(false);
		expect(sheet()).toBe("");
		r?.dispose();
	});

	it("moves only the height variable when only the camera height changes", () => {
		const view3d = createView3dCell({ amount: 1 });
		const { ctx } = fakeCtx({ x: 0, y: 0, zoom: 2 });
		const r = setupCss3dRenderer(ctx, { view3d });
		const before = document.querySelector("style[data-css3d-renderer]");
		const text = sheet();
		view3d.set({ camera: { height: 30 } });
		expect(container.style.getPropertyValue(CAMERA_HEIGHT_VAR)).toBe("60px");
		expect(sheet()).toBe(text);
		expect(document.querySelector("style[data-css3d-renderer]")).toBe(before);
		r?.dispose();
	});

	it("tilts the layers it is given instead of the declared ones", () => {
		const view3d = createView3dCell({ amount: 1 });
		const { ctx } = fakeCtx();
		const r = setupCss3dRenderer(ctx, { view3d });
		r?.api.setTiltLayers(["hud"]);
		expect(r?.api.getTiltLayers()).toEqual(["hud"]);
		expect(sheet()).toContain('"hud"');
		expect(sheet()).not.toContain('"ground"');
		r?.api.setTiltLayers(null);
		expect(r?.api.getTiltLayers()).toEqual(["ground", "cliffs"]);
		r?.dispose();
	});

	it("tells older backgrounds how far to extend, and clears it when flat", () => {
		const view3d = createView3dCell({ amount: 1, drawDistance: 1500 });
		const { ctx, emitted } = fakeCtx();
		const r = setupCss3dRenderer(ctx, { view3d });
		expect(emitted.at(-1)).toEqual(["bg-grid:set-overscan", { px: 700 + 16 }]);
		view3d.set({ amount: 0 });
		expect(emitted.at(-1)).toEqual(["bg-grid:set-overscan", { px: 0 }]);
		r?.dispose();
	});

	it("is null without a 3D view state", () => {
		const { ctx } = fakeCtx();
		expect(setupCss3dRenderer(ctx)).toBeNull();
	});
});

describe("pure parts", () => {
	it("scales the tilt and the height with the amount", () => {
		const state = {
			camera: { pitch: 60, fov: 600, horizon: 0.45, height: 50 },
			amount: 0.5,
			drawDistance: 0,
		};
		expect(layerTransform(state).transform).toBe(
			`perspective(600px) rotateX(30deg) rotateZ(0deg) translateZ(calc(var(${CAMERA_HEIGHT_VAR}, 0px) * -1))`,
		);
		expect(layerTransform(state).transformOrigin).toBe("50% 45%");
		expect(cameraHeightPx(state, 2)).toBe(50);
	});
});
