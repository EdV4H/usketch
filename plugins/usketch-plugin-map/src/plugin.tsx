// createMapPlugin — registers the RPG map feature: the terrain MapLayer, the
// data-only `tilemap` + `base-map` shapes, the base landmark-icon layer, the `map`
// tool (brush/eraser/fill/generate/base), and the Tweaks HUD settings. Landmark
// icons belong to bases (derived from radius), not a separate stamp step.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { BaseIconLayer } from "./base/base-icon-layer.js";
import { BaseAreaLayer } from "./base/base-layer.js";
import { BASE_MAP_TYPE, createBaseMapShapeDefinition } from "./base/base-map-shape.js";
import { EnterBanner } from "./base/enter-banner.js";
import { resolveTerritoryStyle, type TerritoryStyle } from "./base/territory-style.js";
import { genStateStore } from "./gen-state.js";
import { registerMapHud } from "./hud/register-map-hud.js";
import {
	disableInfiniteTerrain,
	enableInfiniteTerrain,
	getInfiniteSeed,
	isInfiniteTerrainEnabled,
} from "./infinite-terrain.js";
import { MapTerrainLayer } from "./map-layer.js";
import { createMapApi, mapService } from "./map-service.js";
import { createMapToolDefinition } from "./map-tool.js";
import { MAP_TOOL_ID } from "./map-tool-id.js";
import type { ColorMode } from "./palette.js";
import { createRangeEraseToolDefinition, RANGE_ERASE_TOOL_ID } from "./range-erase-tool.js";
import { type LineStyle, renderConfigStore } from "./render-config.js";
import { TERRAINS, type TerrainKey } from "./terrain.js";
import { createTileMapShapeDefinition, DEFAULT_TILE, TILEMAP_TYPE } from "./tilemap-shape.js";

export interface MapPluginOptions {
	/** Tile size in world units. Default 40 (matches the design grid). */
	tile?: number;
	defaultColorMode?: ColorMode;
	defaultLineStyle?: LineStyle;
	/**
	 * Terrain used for unset cells (e.g. `"water"` → unpainted/off-map space is
	 * sea). Default undefined = truly empty. Adjustable at runtime via the Control
	 * HUD "空きマス" setting.
	 */
	emptyTerrain?: TerrainKey;
	/**
	 * Appearance of the base "territory" (領域) overlay — fill / border / ring /
	 * label, plus whether to show it only while editing bases (`"base-mode"`,
	 * default) or always. Merges over the defaults; omit for the stock look.
	 */
	territory?: TerritoryStyle;
}

const TERRAIN_LAYER_ID = "usketch-map:terrain";
const BASE_LAYER_ID = "usketch-map:base";
const BASE_ICON_LAYER_ID = "usketch-map:base-icons";
const ENTER_BANNER_ID = "usketch-map:enter-banner";

export function createMapPlugin(options: MapPluginOptions = {}): UsketchPlugin {
	const tile = options.tile ?? DEFAULT_TILE;
	const territoryStyle = resolveTerritoryStyle(options.territory);
	if (options.defaultColorMode || options.defaultLineStyle || options.emptyTerrain) {
		renderConfigStore.set({
			colorMode: options.defaultColorMode,
			lineStyle: options.defaultLineStyle,
			emptyTerrain: options.emptyTerrain,
		});
	}

	return {
		id: "usketch-plugin-map",
		name: "RPG マップ",

		setup(ctx: PluginContext) {
			// ── Shapes (tilemap + base-map = data-only substrates). A base's landmark
			//    icon is NOT a shape: it's derived from the base and drawn by the
			//    BaseIconLayer below (so Select can't grab it). ──
			ctx.shapes.register(TILEMAP_TYPE, createTileMapShapeDefinition(tile));
			ctx.shapes.register(BASE_MAP_TYPE, createBaseMapShapeDefinition(tile));

			// ── Terrain MapLayer (behind all shapes) ──
			ctx.layers.register({
				id: TERRAIN_LAYER_ID,
				order: 40,
				fixed: true,
				render: (lctx) => (
					<MapTerrainLayer store={ctx.store} renderMode={lctx.renderMode} tile={tile} />
				),
			});

			// ── Base areas (above terrain, below shapes) + enter banner overlay ──
			ctx.layers.register({
				id: BASE_LAYER_ID,
				order: 42,
				fixed: true,
				render: (lctx) => (
					<BaseAreaLayer store={ctx.store} renderMode={lctx.renderMode} style={territoryStyle} />
				),
			});
			// ── Base landmark icons (derived from each base's radius/override). Order
			//    44: above terrain (40) and base areas (42), below host resource shapes
			//    (DOM shapes=50) — the "world layer sits under interactive resources"
			//    split (#955). Always visible, unlike the base-mode-gated territory. ──
			ctx.layers.register({
				id: BASE_ICON_LAYER_ID,
				order: 44,
				fixed: true,
				render: (lctx) => (
					<BaseIconLayer store={ctx.store} renderMode={lctx.renderMode} tile={tile} />
				),
			});
			ctx.layers.register({
				id: ENTER_BANNER_ID,
				order: 197,
				fixed: true,
				render: () => <EnterBanner store={ctx.store} tile={tile} />,
			});

			// ── Tools ──
			ctx.tools.register(MAP_TOOL_ID, createMapToolDefinition(tile));
			ctx.tools.register(RANGE_ERASE_TOOL_ID, createRangeEraseToolDefinition(tile));

			// ── Controls: all map operations live on the Control HUD (no bespoke
			//    on-canvas palette). Toggle the HUD with the backtick key. ──
			const unregisterMapHud = registerMapHud(ctx, tile);

			// ── Tweaks as declarative HUD settings ──
			const unregisterHud = ctx.hud.registerSettings({
				id: "usketch-map:tweaks",
				label: "RPG マップ",
				fields: [
					{
						name: "colorMode",
						label: "配色",
						type: "enum",
						options: [
							{ value: "color", label: "カラフル" },
							{ value: "mono", label: "モノクロ" },
						],
					},
					{
						name: "lineStyle",
						label: "線",
						type: "enum",
						options: [
							{ value: "wobble", label: "揺らぎ" },
							{ value: "clean", label: "クリーン" },
						],
					},
					{ name: "strokeScale", label: "線の太さ", type: "number", min: 0.5, max: 2, step: 0.1 },
					{
						name: "emptyTerrain",
						label: "空きマス",
						type: "enum",
						options: [
							{ value: "none", label: "なし" },
							...TERRAINS.map((t) => ({ value: t.key, label: t.name })),
						],
					},
					// Infinite procedurally-generated base terrain: fills all unpainted
					// space deterministically so the world can be panned forever.
					{ name: "infinite", label: "無限地形", type: "boolean" },
					{ name: "seed", label: "シード", type: "number", min: 0, max: 999999, step: 1 },
				],
				get: (name) => {
					if (name === "emptyTerrain") return renderConfigStore.get().emptyTerrain ?? "none";
					// infinite/seed live on the tilemap SHAPE (persisted + synced), not on the
					// app-local render config — so the generated world survives reload.
					if (name === "infinite") return getInfiniteSeed(ctx.store) != null;
					if (name === "seed") return getInfiniteSeed(ctx.store) ?? genStateStore.get().seed;
					return renderConfigStore.get()[name as keyof ReturnType<typeof renderConfigStore.get>];
				},
				set: (name, value) => {
					if (name === "strokeScale") renderConfigStore.set({ strokeScale: Number(value) });
					else if (name === "colorMode") renderConfigStore.set({ colorMode: value as ColorMode });
					else if (name === "lineStyle") renderConfigStore.set({ lineStyle: value as LineStyle });
					else if (name === "emptyTerrain")
						renderConfigStore.set({
							emptyTerrain: value === "none" ? null : (value as TerrainKey),
						});
					else if (name === "infinite") {
						// Drive the public API (single source of truth for the enable logic —
						// deterministic tilemap target, frozen baseGen, integer seed). Default
						// to the gen UI's seed when turning on a board that has none yet.
						if (value === true || value === "true") {
							// Prefer the current/gen seed, but fall back to the API default when
							// it's junk (enableInfiniteTerrain rejects non-finite seeds) so toggling
							// ON always works, even on a corrupt store or bad init order.
							const genSeed =
								getInfiniteSeed(ctx.store) ?? Math.trunc(Number(genStateStore.get().seed));
							enableInfiniteTerrain(ctx.store, {
								seed: Number.isFinite(genSeed) ? genSeed : undefined,
								tile,
							});
						} else {
							disableInfiniteTerrain(ctx.store);
						}
					} else if (name === "seed") {
						// Coerce to a finite integer (matches step:1); ignore junk.
						const seed = Math.trunc(Number(value));
						if (!Number.isFinite(seed)) return;
						// Remember on the gen store, and re-seed only when already enabled (the
						// seed field shouldn't turn the infinite terrain on by itself).
						genStateStore.set({ seed });
						if (isInfiniteTerrainEnabled(ctx.store)) enableInfiniteTerrain(ctx.store, { seed });
					}
				},
				// Re-read on look-and-feel changes (renderConfig) AND shape mutations (the
				// tilemap shape now carries infinite/seed), so the toggle reflects the shape
				// even when edited elsewhere or by another client. Filter to shape events —
				// not viewport/selection — so panning/zooming doesn't re-evaluate the HUD.
				subscribe: (listener) => {
					const unsubConfig = renderConfigStore.subscribe(listener);
					const unsubStore = ctx.store.onMutation((e) => {
						if (
							e.type === "shape:added" ||
							e.type === "shape:removed" ||
							e.type === "shape:updated"
						)
							listener();
					});
					return () => {
						unsubConfig();
						unsubStore();
					};
				},
			});

			// ── Host-facing API (ctx.services seam) — lets a host or another plugin
			//    drive map operations without the Control HUD. See map-service.ts.
			//    Provided LAST, after every throw-prone registration above, so a setup
			//    failure can't leak the service (createApp only rolls back a returned
			//    teardown). ──
			const unprovideService = mapService.provide(ctx.services, createMapApi(ctx.store, tile));

			return () => {
				unprovideService();
				ctx.layers.unregister(TERRAIN_LAYER_ID);
				ctx.layers.unregister(BASE_LAYER_ID);
				ctx.layers.unregister(BASE_ICON_LAYER_ID);
				ctx.layers.unregister(ENTER_BANNER_ID);
				unregisterMapHud();
				unregisterHud();
			};
		},
	};
}
