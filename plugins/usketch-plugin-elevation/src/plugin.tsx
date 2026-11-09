// Elevation plugin: the board's ground has a height at every point — an infinite
// generated terrain from a seed, plus what the brush adds — instead of the map's
// per-cell steps. The flat board shows it as colours, shading and contour lines; the
// shared ground-height service reports it, so a walking character goes up and down the
// slopes and 3D shapes stand on the hills.
//
// It depends on no other plugin. With the map on the same board only one of them
// owns the height: a board with an elevation field uses this plugin's, and the map's
// cliffs and steps are switched off there (through the map's service, if present).
import {
	defineService,
	groundHeightService,
	type PluginContext,
	type UsketchPlugin,
	view3dService,
} from "@edv4h/usketch-shared";
import { BRUSH_CURSOR_LAYER_ID, BrushCursorLayer } from "./brush-cursor-layer.js";
import { type BrushSettings, DEFAULT_BRUSH, normalizeBrush } from "./elevation-brush.js";
import { CHUNK_TYPE, FIELD_TYPE } from "./elevation-field.js";
import { ElevationGroundLayer, GROUND_LAYER_ID, type StrokePreview } from "./elevation-layer.js";
import { ElevationMeshLayer, MESH_LAYER_ID, type MeshState } from "./elevation-mesh-layer.js";
import { boardElevation, elevationSampler, setBaseCacheLimit } from "./elevation-model.js";
import { createElevationApi, elevationService } from "./elevation-service.js";
import { DEFAULT_DISPLAY, type ElevationDisplay } from "./elevation-shade.js";
import { createChunkShapeDefinition, createFieldShapeDefinition } from "./elevation-shapes.js";
import {
	type BrushCursor,
	createElevationToolDefinition,
	ELEVATION_TOOL_ID,
} from "./elevation-tool.js";
import { createReactiveStore } from "./reactive-store.js";
import { registerElevationHud } from "./register-elevation-hud.js";

export interface ElevationPluginOptions {
	/** The initial look (colours / shading / contours). */
	display?: Partial<ElevationDisplay>;
	/** The brush's initial settings. */
	brush?: Partial<BrushSettings>;
	/** Generated chunks kept in memory (about 4 KB each). Default 512. */
	baseCacheChunks?: number;
	/**
	 * Draw the ground as a raised surface (WebGL2) in a 3D view such as Mode 7. Off:
	 * the flat colours / shading are tilted with the board. Default on.
	 */
	mesh?: boolean;
	/** Most screen px of ground drawn past the viewport for a 3D view. Default 1200. */
	maxOverscanPx?: number;
	/**
	 * Stacking order of the flat ground layer. Default 45: above the map's ground (40–44),
	 * below the shapes (50). Lower it (e.g. 41.5) to keep layers such as the map's base
	 * areas (42) and base icons (44) drawn over the elevation.
	 */
	groundOrder?: number;
	/**
	 * Stacking order of the 3D mesh layer. Default 46, just above the flat ground. Like
	 * `groundOrder`, lower it to keep other ground layers drawn over the raised surface.
	 */
	meshOrder?: number;
}

/** Default stacking orders of the ground and mesh layers. */
export const DEFAULT_GROUND_ORDER = 45;
export const DEFAULT_MESH_ORDER = 46;

/** Event a 3D view emits with the screen px of ground it shows past the viewport. */
export const GROUND_OVERSCAN_EVENT = "bg-grid:set-overscan";
const DEFAULT_MAX_OVERSCAN_PX = 1200;

/**
 * The map plugin's switch for its own heights, looked up by its service key without
 * importing the map (an optional partner). Only this one method is used.
 */
const mapHeightSwitch = defineService<{ setHeightEnabled?: (on: boolean) => void }>(
	"usketch-plugin-map",
);

export function createElevationPlugin(options: ElevationPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-elevation",
		name: "標高",
		setup(ctx: PluginContext) {
			if (options.baseCacheChunks !== undefined) setBaseCacheLimit(options.baseCacheChunks);
			ctx.shapes.register(FIELD_TYPE, createFieldShapeDefinition());
			ctx.shapes.register(CHUNK_TYPE, createChunkShapeDefinition());

			const display = createReactiveStore<ElevationDisplay>({
				...DEFAULT_DISPLAY,
				...options.display,
			});
			const brush = createReactiveStore<BrushSettings>(
				normalizeBrush({ ...DEFAULT_BRUSH, ...options.brush }),
			);
			const preview = createReactiveStore<StrokePreview>({ model: null });
			const cursor = createReactiveStore<BrushCursor>({ x: 0, y: 0, visible: false });
			const view3d = () => view3dService.get(ctx.services);
			const mesh = createReactiveStore<MeshState>({ drawing: false });
			const maxOverscan = options.maxOverscanPx ?? DEFAULT_MAX_OVERSCAN_PX;
			const overscan = createReactiveStore({ px: 0 });
			const offOverscan = ctx.events.on<{ px: number }>(GROUND_OVERSCAN_EVENT, (data) => {
				const px = Number(data?.px);
				overscan.set({ px: Number.isFinite(px) ? Math.min(Math.max(0, px), maxOverscan) : 0 });
			});

			ctx.layers.register({
				id: GROUND_LAYER_ID,
				// Above the map's ground (40–44), below the shapes (50), unless the host says.
				order: options.groundOrder ?? DEFAULT_GROUND_ORDER,
				avoidCollision: true,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: () => (
					<ElevationGroundLayer
						store={ctx.store}
						display={display}
						overscan={overscan}
						preview={preview}
						mesh={options.mesh === false ? undefined : mesh}
					/>
				),
			});
			if (options.mesh !== false) {
				ctx.layers.register({
					id: MESH_LAYER_ID,
					// Just above the flat ground, below the shapes. NOT tilted by Mode 7: it
					// projects itself (and so isn't in Mode 7's tilt list).
					order: options.meshOrder ?? DEFAULT_MESH_ORDER,
					avoidCollision: true,
					fixed: true,
					render: () => (
						<ElevationMeshLayer
							store={ctx.store}
							display={display}
							overscan={overscan}
							view3d={view3d}
							state={mesh}
						/>
					),
				});
			}
			ctx.layers.register({
				id: BRUSH_CURSOR_LAYER_ID,
				// Over the shapes, under the selection UI and the HUD.
				order: 150,
				avoidCollision: true,
				fixed: true,
				worldOverlay: true,
				render: () => (
					<BrushCursorLayer
						store={ctx.store}
						brush={brush}
						cursor={cursor}
						preview={preview}
						view3d={view3d}
					/>
				),
			});
			ctx.tools.register(
				ELEVATION_TOOL_ID,
				createElevationToolDefinition({ brush, preview, cursor }),
			);

			const api = createElevationApi(ctx.store, ctx.commands, display, brush);
			const stopHud = registerElevationHud(ctx, api);

			// One owner of the board's height: this plugin where the board has a field, the
			// provider that was there before (the map) elsewhere. Always provided (and
			// delegating) rather than provided on demand, because taking it away again would
			// leave no provider at all — the registry keeps only the latest.
			const previous = groundHeightService.get(ctx.services);
			const heightAt = (x: number, y: number): number => {
				const model = boardElevation(ctx.store);
				if (model) return elevationSampler(model).heightAt(x, y);
				return previous?.heightAt(x, y) ?? 0;
			};

			// Switch the map's own heights (cliffs, steps) off while the board has a field.
			let mapHeightOff = false;
			const syncMapHeight = () => {
				const want = boardElevation(ctx.store) !== null;
				if (want === mapHeightOff) return;
				const map = mapHeightSwitch.get(ctx.services);
				if (!map?.setHeightEnabled) return;
				map.setHeightEnabled(!want);
				mapHeightOff = want;
			};
			const offStore = ctx.store.subscribe(syncMapHeight);
			syncMapHeight();

			// Provide the services LAST so a failed earlier step can't leak them.
			const ground = { heightAt };
			const unprovideGround = groundHeightService.provide(ctx.services, ground);
			const unprovide = elevationService.provide(ctx.services, api);

			return () => {
				unprovide();
				// Hand the height back to the previous provider only while ours is still the
				// one in use: a provider that came after this plugin stays.
				const stillOurs = groundHeightService.get(ctx.services) === ground;
				unprovideGround();
				if (stillOurs && previous) groundHeightService.provide(ctx.services, previous);
				offStore();
				if (mapHeightOff) mapHeightSwitch.get(ctx.services)?.setHeightEnabled?.(true);
				stopHud();
				ctx.layers.unregister(GROUND_LAYER_ID);
				if (options.mesh !== false) ctx.layers.unregister(MESH_LAYER_ID);
				ctx.layers.unregister(BRUSH_CURSOR_LAYER_ID);
				offOverscan();
			};
		},
	};
}
