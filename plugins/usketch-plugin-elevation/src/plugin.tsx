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
} from "@edv4h/usketch-shared";
import { CHUNK_TYPE, FIELD_TYPE } from "./elevation-field.js";
import { ElevationGroundLayer, GROUND_LAYER_ID } from "./elevation-layer.js";
import { boardElevation, elevationSampler, setBaseCacheLimit } from "./elevation-model.js";
import { createElevationApi, elevationService } from "./elevation-service.js";
import { DEFAULT_DISPLAY, type ElevationDisplay } from "./elevation-shade.js";
import { createChunkShapeDefinition, createFieldShapeDefinition } from "./elevation-shapes.js";
import { createReactiveStore } from "./reactive-store.js";
import { registerElevationHud } from "./register-elevation-hud.js";

export interface ElevationPluginOptions {
	/** The initial look (colours / shading / contours). */
	display?: Partial<ElevationDisplay>;
	/** Generated chunks kept in memory (about 4 KB each). Default 512. */
	baseCacheChunks?: number;
	/** Most screen px of ground drawn past the viewport for a 3D view. Default 1200. */
	maxOverscanPx?: number;
}

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
			const maxOverscan = options.maxOverscanPx ?? DEFAULT_MAX_OVERSCAN_PX;
			const overscan = createReactiveStore({ px: 0 });
			const offOverscan = ctx.events.on<{ px: number }>(GROUND_OVERSCAN_EVENT, (data) => {
				const px = Number(data?.px);
				overscan.set({ px: Number.isFinite(px) ? Math.min(Math.max(0, px), maxOverscan) : 0 });
			});

			ctx.layers.register({
				id: GROUND_LAYER_ID,
				// Above the map's ground (40–44), below the shapes (50).
				order: 45,
				avoidCollision: true,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: () => (
					<ElevationGroundLayer store={ctx.store} display={display} overscan={overscan} />
				),
			});

			const api = createElevationApi(ctx.store, ctx.commands, display);
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
			const unprovideGround = groundHeightService.provide(ctx.services, { heightAt });
			const unprovide = elevationService.provide(ctx.services, api);

			return () => {
				unprovide();
				unprovideGround();
				if (previous) groundHeightService.provide(ctx.services, previous);
				offStore();
				if (mapHeightOff) mapHeightSwitch.get(ctx.services)?.setHeightEnabled?.(true);
				stopHud();
				ctx.layers.unregister(GROUND_LAYER_ID);
				offOverscan();
			};
		},
	};
}
