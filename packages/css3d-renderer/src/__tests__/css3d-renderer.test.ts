// @vitest-environment jsdom
import {
	createView3dCell,
	type HudSettingsDescriptor,
	type Layer,
	type PluginContext,
	type ServiceRegistry,
	view3dOcclusionService,
} from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { depthStageRules } from "../css3d-css.js";
import {
	CAMERA_HEIGHT_VAR,
	cameraHeightPx,
	DEPTH_STAGE_FIELD,
	LEGACY_STAGE_ATTR,
	layerTransform,
	OCCLUSION_FIELD,
	STAGE_ATTR,
	setupCss3dRenderer,
} from "../css3d-renderer.js";

const LAYERS: Layer[] = [
	{ id: "ground", order: 0, view3d: "tilt", render: () => null },
	{ id: "cliffs", order: 1, view3d: "depth", render: () => null },
	{ id: "hud", order: 2, fixed: true, render: () => null },
];

function services(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide(key, value) {
			map.set(key, value);
			return () => map.delete(key);
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key) => map.has(key),
	};
}

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
		services: services(),
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
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
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
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
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
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
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
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
		expect(emitted.at(-1)).toEqual(["bg-grid:set-overscan", { px: 700 + 16 }]);
		view3d.set({ amount: 0 });
		expect(emitted.at(-1)).toEqual(["bg-grid:set-overscan", { px: 0 }]);
		r?.dispose();
	});

	it("is null without a 3D view state", () => {
		const { ctx } = fakeCtx();
		expect(setupCss3dRenderer(ctx)).toBeNull();
	});

	it("sorts by depth only when the depth stage is on, and clips the parent instead", () => {
		const view3d = createView3dCell({ amount: 1 });
		const { ctx } = fakeCtx();
		const parent = document.createElement("div");
		parent.style.overflow = "auto";
		document.body.appendChild(parent);
		parent.appendChild(container);
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
		expect(r?.api.isDepthStage()).toBe(false);
		expect(sheet()).not.toContain("preserve-3d !important;overflow:visible");
		r?.api.setDepthStage(true);
		expect(r?.api.isDepthStage()).toBe(true);
		expect(sheet()).toContain("preserve-3d !important;overflow:visible");
		// The HUD is after the tilted layers: pushed to the front.
		expect(sheet()).toContain('[data-layer-id="hud"]{transform:translateZ(100002px)');
		expect(parent.style.overflow).toBe("clip");
		r?.api.setDepthStage(false);
		expect(sheet()).not.toContain("preserve-3d !important;overflow:visible");
		expect(parent.style.overflow).toBe("auto");
		r?.api.setDepthStage(true);
		view3d.set({ amount: 0 });
		expect(parent.style.overflow).toBe("auto");
		r?.dispose();
		parent.remove();
	});

	it("offers the depth stage on the HUD", () => {
		const view3d = createView3dCell({ amount: 1 });
		const { ctx } = fakeCtx();
		let descriptor: HudSettingsDescriptor | null = null;
		const unregister = vi.fn();
		(ctx as { hud: unknown }).hud = {
			registerSettings: (d: HudSettingsDescriptor) => {
				descriptor = d;
				return unregister;
			},
		};
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
		const d = descriptor as HudSettingsDescriptor | null;
		expect(d?.fields.map((f) => f.name)).toEqual([OCCLUSION_FIELD, DEPTH_STAGE_FIELD]);
		d?.set(OCCLUSION_FIELD, "hide");
		expect(r?.api.getOcclusion()).toBe("hide");
		expect(d?.get(OCCLUSION_FIELD)).toBe("hide");
		const seen = vi.fn();
		d?.subscribe(seen);
		d?.set(DEPTH_STAGE_FIELD, true);
		expect(r?.api.isDepthStage()).toBe(true);
		expect(d?.get(DEPTH_STAGE_FIELD)).toBe(true);
		expect(seen).toHaveBeenCalledTimes(1);
		r?.dispose();
		expect(unregister).toHaveBeenCalled();
	});
});

describe("what the ground hides", () => {
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

	// A ridge 200 high across y = 300: the eye is toward +y, so it hides points behind it.
	const ridge = {
		groundAt: (_x: number, y: number) => (Math.abs(y - 300) < 40 ? 200 : 0),
		subscribe: () => () => {},
	};

	it("provides the occlusion while set up, answering from the camera and the ground", () => {
		const view3d = createView3dCell();
		const { ctx } = fakeCtx();
		(ctx as { height: unknown }).height = ridge;
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
		const occlusion = view3dOcclusionService.get(ctx.services);
		expect(occlusion).toBeDefined();
		// Flat: nothing is hidden.
		expect(occlusion?.hidden(640, -200, 0)).toBe(false);
		view3d.set({ amount: 1, camera: { pitch: 60, fov: 600, horizon: 0.45 } });
		expect(occlusion?.hidden(640, -200, 0)).toBe(true);
		expect(occlusion?.hidden(640, 380, 0)).toBe(false);
		expect(occlusion?.look()).toBe("fade");
		r?.api.setOcclusion("hide");
		expect(occlusion?.look()).toBe("hide");
		r?.api.setOcclusion("none");
		expect(occlusion?.hidden(640, -200, 0)).toBe(false);
		r?.dispose();
		expect(view3dOcclusionService.get(ctx.services)).toBeUndefined();
	});

	it("tells its listeners when the setting or the camera changes", () => {
		const view3d = createView3dCell({ amount: 1 });
		const { ctx } = fakeCtx();
		(ctx as { height: unknown }).height = ridge;
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
		const seen = vi.fn();
		const off = view3dOcclusionService.get(ctx.services)?.subscribe(seen);
		r?.api.setOcclusion("hide");
		view3d.set({ camera: { pitch: 40 } });
		expect(seen).toHaveBeenCalledTimes(2);
		off?.();
		r?.dispose();
	});

	it("leaves an existing provider alone", () => {
		const view3d = createView3dCell({ amount: 1 });
		const { ctx } = fakeCtx();
		const other = { hidden: () => true, look: () => "hide" as const, subscribe: () => () => {} };
		view3dOcclusionService.provide(ctx.services, other);
		const r = setupCss3dRenderer(ctx, { view3d, shapes: false });
		expect(view3dOcclusionService.get(ctx.services)).toBe(other);
		r?.dispose();
		expect(view3dOcclusionService.get(ctx.services)).toBe(other);
	});
});

describe("depth stage rules", () => {
	const T = "perspective(600px) rotateX(60deg)";

	it("pushes untilted layers out of the way: behind before the ground, else in front", () => {
		const css = depthStageRules({
			stageAttr: "data-s",
			layers: [
				{ id: "sky", tilted: false },
				{ id: "ground", tilted: true },
				{ id: "fog", tilted: false },
			],
			background: "#fff",
			tiltTransform: T,
		});
		expect(css).toContain('[data-s="on"]{transform-style:preserve-3d !important;');
		expect(css).toContain("background:transparent !important");
		// The stage's background is redrawn far behind everything.
		expect(css).toContain("background:#fff;transform:translateZ(-300000px)");
		expect(css).toContain('>[data-layer-id="sky"]{transform:translateZ(-100000px)');
		expect(css).not.toContain('"ground"');
		expect(css).toContain('>[data-layer-id="fog"]{transform:translateZ(100002px)');
	});

	it("keeps what a ground-drawing layer covers under it, tilted or not", () => {
		const css = depthStageRules({
			stageAttr: "data-s",
			layers: [
				{ id: "sky", tilted: false },
				{ id: "grid", tilted: true },
				{ id: "mesh", tilted: false, ground: true },
				{ id: "shapes", tilted: true },
				{ id: "hud", tilted: false },
			],
			background: "#fff",
			tiltTransform: T,
		});
		expect(css).toContain('>[data-layer-id="sky"]{transform:translateZ(-200000px)');
		// Moved back along the view before its tilt: the same pixels, but behind.
		expect(css).toContain(
			`>[data-layer-id="grid"]{transform:translateZ(-199999px) ${T} !important`,
		);
		expect(css).toContain('>[data-layer-id="mesh"]{transform:translateZ(-99998px)');
		expect(css).not.toContain('"shapes"');
		expect(css).toContain('>[data-layer-id="hud"]{transform:translateZ(100004px)');
	});

	it("puts every layer behind when nothing is tilted", () => {
		const css = depthStageRules({
			stageAttr: "data-s",
			layers: [{ id: "a", tilted: false }],
			background: "transparent",
			tiltTransform: T,
		});
		expect(css).toContain('>[data-layer-id="a"]{transform:translateZ(-100000px)');
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
