// Shape 3D plugin: shapes that hold 3D parameters (`x-shape-3d`) stand out of the ground
// while the board is shown in 3D (Mode 7), instead of lying flat on it. Pure CSS 3D,
// like the map's cliffs — no 3D library. The 2D board, export and editing are untouched:
// outside a 3D view this plugin draws nothing.
//
// It depends on neither Mode 7 nor the map: the view comes from the shared
// `view3dService`, the ground from the board's height, and the DOM shape layer is told
// which shapes to skip with its `renderer:hide-shapes` event. Shapes with a `collision`
// are a solid provider on the board's height, which a character walking the board consults.
import { HIDE_SHAPES_EVENT, VIEWPORT_OVERSCAN_EVENT } from "@edv4h/usketch-dom-renderer";
import {
	boardHeight,
	type PluginContext,
	type ShapeData,
	type UsketchPlugin,
	view3dService,
} from "@edv4h/usketch-shared";
import { registerShape3dHud } from "./register-shape-3d-hud.js";
import { buildColliderIndex, type ColliderIndex, solidHeightAt } from "./shape-3d-collision.js";
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
	/** Draw limits (min on-screen size, max count) and whether collision is 3D-only. */
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
			// The board's height: the ground the shapes stand on, and where their solids go.
			const height = ctx.height ?? boardHeight(ctx.services);
			const heightAt = (x: number, y: number) => height.groundAt(x, y);
			// The view's camera for a type's own `render3d`. Notifications go through the
			// tracker, which attaches to a provider that sets up later or comes and goes.
			const camera: Shape3dCameraSource = {
				get: () => view3dService.get(ctx.services)?.camera() ?? null,
				subscribe: (listener) => tracker.subscribeCamera(listener),
			};

			// Solids for the character: rebuilt lazily when the shapes or the type settings
			// change (both are replaced, never mutated, on a change).
			let colliders: {
				shapes: ReadonlyMap<string, ShapeData>;
				types: unknown;
				index: ColliderIndex;
			} | null = null;
			const colliderIndex = (): ColliderIndex => {
				const shapes = ctx.store.getShapes();
				const types = settings.get().types;
				if (colliders?.shapes !== shapes || colliders.types !== types) {
					colliders = { shapes, types, index: buildColliderIndex(shapes.values(), types) };
				}
				return colliders.index;
			};
			const solidAt = (x: number, y: number): number | null => {
				if (settings.get().limits.collisionIn3dOnly && !(tracker.get().amount > 0)) return null;
				return solidHeightAt(colliderIndex(), x, y, heightAt);
			};

			ctx.layers.register({
				id: SHAPE_3D_LAYER_ID,
				view3d: "depth",
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
			// Provide the services LAST so a failed earlier step can't leak them.
			const unregisterSolid = height.register({
				id: "usketch-plugin-shape-3d",
				kind: "solid",
				heightAt: solidAt,
			});
			const unprovide = shape3dService.provide(ctx.services, api);

			return () => {
				unprovide();
				unregisterSolid();
				colliders = null;
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
