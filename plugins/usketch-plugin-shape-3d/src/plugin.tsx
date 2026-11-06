// Shape 3D plugin: shapes that hold 3D parameters (`x-shape-3d`) stand out of the ground
// while the board is shown in 3D (Mode 7), instead of lying flat on it. Pure CSS 3D,
// like the map's cliffs — no 3D library. The 2D board, export and editing are untouched:
// outside a 3D view this plugin draws nothing.
//
// It depends on neither Mode 7 nor the map: the view comes from the shared
// `view3dService`, the ground from `groundHeightService`, and the DOM shape layer is told
// which shapes to skip with its `renderer:hide-shapes` event.
import { HIDE_SHAPES_EVENT, VIEWPORT_OVERSCAN_EVENT } from "@edv4h/usketch-dom-renderer";
import {
	groundHeightService,
	type PluginContext,
	type UsketchPlugin,
	view3dService,
} from "@edv4h/usketch-shared";
import { registerShape3dHud } from "./register-shape-3d-hud.js";
import { SHAPE_3D_LAYER_ID, type Shape3dCameraSource, Shape3dLayer } from "./shape-3d-layer.js";
import type { Shape3dLimits } from "./shape-3d-layout.js";
import type { Shape3dTypes } from "./shape-3d-params.js";
import { createShape3dApi, shape3dService } from "./shape-3d-service.js";
import { createShape3dSettings } from "./shape-3d-settings.js";
import { createView3dTracker } from "./view-3d-tracker.js";

export interface Shape3dPluginOptions {
	/**
	 * Per shape type: which 3D modes it may use and a default for shapes holding no
	 * parameters of their own (e.g. `{ "board-portal": { default: { mode: "stand" } } }`).
	 * Merged over the built-in `DEFAULT_SHAPE_3D_TYPES`. Unlisted types may use every mode.
	 */
	types?: Shape3dTypes;
	/** Draw limits (min on-screen size, max count). */
	limits?: Partial<Shape3dLimits>;
}

const HIDE_SOURCE = "usketch-plugin-shape-3d";

export function createShape3dPlugin(options: Shape3dPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-3d",
		name: "Shape 3D",
		setup(ctx: PluginContext) {
			const settings = createShape3dSettings({ types: options.types, limits: options.limits });
			const tracker = createView3dTracker(ctx.services, ctx.events);
			const api = createShape3dApi(ctx.store, settings);

			let overscanPx = 0;
			const offOverscan = ctx.events.on<{ px: number }>(VIEWPORT_OVERSCAN_EVENT, ({ px }) => {
				const next = Number.isFinite(px) && px > 0 ? px : 0;
				if (next === overscanPx) return;
				overscanPx = next;
				ctx.events.emit("layers:changed", {});
			});
			const offSettings = settings.subscribe(() => ctx.events.emit("layers:changed", {}));

			// Tell the DOM layer which shapes are drawn here (only when the set changes).
			let lastHidden = "";
			const onDrawn = (ids: ReadonlySet<string>) => {
				const key = [...ids].join("\n");
				if (key === lastHidden) return;
				lastHidden = key;
				ctx.events.emit(HIDE_SHAPES_EVENT, { source: HIDE_SOURCE, ids });
			};
			const heightAt = (x: number, y: number) =>
				groundHeightService.get(ctx.services)?.heightAt(x, y) ?? 0;
			// The view's camera for a type's own `render3d` (looked up on use: the provider
			// may set up after this plugin, or come and go).
			const camera: Shape3dCameraSource = {
				get: () => view3dService.get(ctx.services)?.camera() ?? null,
				subscribe: (listener) => {
					const api = view3dService.get(ctx.services);
					return api ? api.subscribe(listener) : () => {};
				},
			};

			ctx.layers.register({
				id: SHAPE_3D_LAYER_ID,
				// Just above the flat DOM shapes (50); a fixed layer placed in screen px.
				order: 51,
				avoidCollision: true,
				fixed: true,
				render: (rc) => (
					<Shape3dLayer
						rc={rc}
						shapes={ctx.shapes}
						tracker={tracker}
						types={settings.get().types}
						limits={settings.get().limits}
						overscanPx={overscanPx}
						heightAt={heightAt}
						onDrawn={onDrawn}
						camera={camera}
					/>
				),
			});
			const stopHud = registerShape3dHud(ctx, api, settings);
			// Provide the service LAST so a failed earlier step can't leak it.
			const unprovide = shape3dService.provide(ctx.services, api);

			return () => {
				unprovide();
				stopHud();
				ctx.layers.unregister(SHAPE_3D_LAYER_ID);
				ctx.events.emit(HIDE_SHAPES_EVENT, { source: HIDE_SOURCE, ids: new Set<string>() });
				offSettings();
				offOverscan();
				tracker.dispose();
			};
		},
	};
}
