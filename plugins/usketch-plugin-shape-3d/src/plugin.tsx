// Shape 3D plugin: the HUD to give shapes a 3D look (`ShapeData.view3d`) — stand / box /
// float, and how a walking character meets them — and its per-viewer settings. The CSS 3D
// renderer draws the shapes (`@edv4h/usketch-css3d-renderer`) and the core makes their
// solids; this plugin hands both its type table (it also covers types that don't declare
// their 3D yet, and the deprecated `types` option) and its limits.
import { css3dShapeSourceService } from "@edv4h/usketch-css3d-renderer";
import {
	boardHeight,
	createShapeSolids,
	createView3dTracker,
	type PluginContext,
	shapeSolidsService,
	type UsketchPlugin,
} from "@edv4h/usketch-shared";
import { registerShape3dHud } from "./register-shape-3d-hud.js";
import type { Shape3dLimits } from "./shape-3d-layout.js";
import type { Shape3dTypeConfig, Shape3dTypes } from "./shape-3d-params.js";
import { createShape3dApi, shape3dService } from "./shape-3d-service.js";
import { createShape3dSettings, type DeclaredShape3dTypes } from "./shape-3d-settings.js";

export interface Shape3dPluginOptions {
	/**
	 * Per shape type: which 3D modes it may use and a default for shapes holding no
	 * parameters of their own (e.g. `{ "board-portal": { default: { mode: "stand" } } }`).
	 * Merged over what the type declares (`ShapeDefinition.view3d`, with the host's
	 * `ctx.shapes.configureView3d`) and the built-in `DEFAULT_SHAPE_3D_TYPES`.
	 * @deprecated Use `ctx.shapes.configureView3d(type, view3d)`; removed at the next major.
	 */
	types?: Shape3dTypes;
	/** Draw limits (min on-screen size, max count) and whether collision is 3D-only. */
	limits?: Partial<Shape3dLimits>;
}

export function createShape3dPlugin(options: Shape3dPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-shape-3d",
		name: "Shape 3D",
		setup(ctx: PluginContext) {
			// The shape types' own 3D: declared by their plugins, overridden by the host.
			let overrideVersion = 0;
			const offOverrides = ctx.shapes.subscribeView3d?.(() => {
				overrideVersion++;
				ctx.events.emit("layers:changed", {});
			});
			const declared: DeclaredShape3dTypes = {
				read() {
					const out: Record<string, Shape3dTypeConfig> = {};
					for (const [type, def] of ctx.shapes.getAll()) {
						const view3d = ctx.shapes.getView3d ? ctx.shapes.getView3d(type) : def.view3d;
						if (view3d) out[type] = view3d;
					}
					return out;
				},
				version: () => `${ctx.shapes.getAll().size}:${overrideVersion}`,
			};
			const settings = createShape3dSettings({
				types: options.types,
				limits: options.limits,
				declared,
			});
			const api = createShape3dApi(ctx.store, settings);
			// The renderer draws by our settings: re-draw when they change.
			const offSettings = settings.subscribe(() => ctx.events.emit("layers:changed", {}));

			// The board's height: the ground the shapes stand on, and where their solids go.
			const height = ctx.height ?? boardHeight(ctx.services);
			// Solids for the character: the core's shape solids (it registers them on the
			// board's height), or our own with an older core. Either reads this plugin's
			// type table (it also covers types that don't declare their 3D yet) and limit.
			const coreSolids = shapeSolidsService.get(ctx.services);
			// Our own solids follow the 3D view themselves (the core's read its view state).
			const tracker = coreSolids ? null : createView3dTracker(ctx.services, ctx.events);
			const solids =
				coreSolids ??
				createShapeSolids({
					shapes: () => ctx.store.getShapes(),
					typeView3d: (type) => settings.get().types[type],
					groundAt: (x, y) => height.groundAt(x, y),
					view3dAmount: () => tracker?.get().amount ?? 0,
				});
			// The table is replaced, never mutated, on a change: its identity is the version.
			solids.setTypeView3d(
				(type) => settings.get().types[type],
				() => settings.get().types,
			);
			const syncSolids = () => solids.setIn3dOnly(settings.get().limits.collisionIn3dOnly);
			syncSolids();
			const offSolidLimits = settings.subscribe(syncSolids);

			const stopHud = registerShape3dHud(ctx, api, settings);
			// Provide the services LAST so a failed earlier step can't leak them.
			const unregisterSolid = coreSolids ? () => {} : height.register(solids.provider);
			const unprovideSource = css3dShapeSourceService.provide(ctx.services, {
				types: () => settings.get().types,
				limits: () => settings.get().limits,
			});
			const unprovide = shape3dService.provide(ctx.services, api);

			return () => {
				unprovide();
				unprovideSource();
				unregisterSolid();
				offSolidLimits();
				solids.setTypeView3d(null);
				solids.setIn3dOnly(false);
				offOverrides?.();
				stopHud();
				offSettings();
				tracker?.dispose();
			};
		},
	};
}
