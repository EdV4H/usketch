// createMapPlugin — registers the RPG map feature: the terrain MapLayer, the
// data-only `tilemap` shape, the foreground `map-icon` shape, the `map` tool
// (brush/eraser/fill/stamp), the on-canvas palette, and the Tweaks HUD settings.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { BaseAreaLayer } from "./base/base-layer.js";
import { BASE_MAP_TYPE, createBaseMapShapeDefinition } from "./base/base-map-shape.js";
import { EnterBanner } from "./base/enter-banner.js";
import { genStateStore } from "./gen-state.js";
import { resolveTilemap } from "./generate.js";
import { registerMapHud } from "./hud/register-map-hud.js";
import { MAP_ICON_TYPE, mapIconShapeDefinition } from "./map-icon-shape.js";
import { MapTerrainLayer } from "./map-layer.js";
import { createMapToolDefinition } from "./map-tool.js";
import { MAP_TOOL_ID } from "./map-tool-id.js";
import type { ColorMode } from "./palette.js";
import { createRangeEraseToolDefinition, RANGE_ERASE_TOOL_ID } from "./range-erase-tool.js";
import { type LineStyle, renderConfigStore } from "./render-config.js";
import { TERRAINS, type TerrainKey } from "./terrain.js";
import {
	createTileMapShapeDefinition,
	DEFAULT_TILE,
	isTileMap,
	TILEMAP_TYPE,
	type TileMapShapeData,
} from "./tilemap-shape.js";

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
}

const TERRAIN_LAYER_ID = "usketch-map:terrain";
const BASE_LAYER_ID = "usketch-map:base";
const ENTER_BANNER_ID = "usketch-map:enter-banner";

export function createMapPlugin(options: MapPluginOptions = {}): UsketchPlugin {
	const tile = options.tile ?? DEFAULT_TILE;
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
			// ── Shapes (tilemap + base-map = data-only substrates, map-icon = foreground) ──
			ctx.shapes.register(TILEMAP_TYPE, createTileMapShapeDefinition(tile));
			ctx.shapes.register(BASE_MAP_TYPE, createBaseMapShapeDefinition(tile));
			ctx.shapes.register(MAP_ICON_TYPE, mapIconShapeDefinition);

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
				render: (lctx) => <BaseAreaLayer store={ctx.store} renderMode={lctx.renderMode} />,
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

			// The infinite-terrain seed is read from the first tilemap shape carrying one
			// (board data — persisted + synced), not from app-local render config.
			const currentBaseSeed = (): number | null => {
				for (const [, s] of ctx.store.getShapes())
					if (isTileMap(s) && s.baseSeed != null) return s.baseSeed;
				return null;
			};

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
					if (name === "infinite") return currentBaseSeed() != null;
					if (name === "seed") return currentBaseSeed() ?? genStateStore.get().seed;
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
						const on = value === true || value === "true";
						if (on) {
							// Stamp the seed onto a tilemap (creating one if the board is blank),
							// so it persists + syncs. Reuse the existing seed if already enabled.
							const seed = currentBaseSeed() ?? genStateStore.get().seed;
							const { id } = resolveTilemap(ctx.store, tile);
							ctx.store.updateShape(id, { baseSeed: seed } as Partial<TileMapShapeData>);
						} else {
							for (const [id, s] of ctx.store.getShapes())
								if (isTileMap(s) && s.baseSeed != null)
									ctx.store.updateShape(id, { baseSeed: undefined } as Partial<TileMapShapeData>);
						}
					} else if (name === "seed") {
						// Coerce to a finite integer (matches step:1); ignore junk so a bad
						// value can't turn baseSeed into NaN → NaN elevations everywhere.
						const seed = Math.trunc(Number(value));
						if (!Number.isFinite(seed)) return;
						// Remember on the gen store, and re-seed any tilemap that already has a base.
						genStateStore.set({ seed });
						for (const [id, s] of ctx.store.getShapes())
							if (isTileMap(s) && s.baseSeed != null)
								ctx.store.updateShape(id, { baseSeed: seed } as Partial<TileMapShapeData>);
					}
				},
				// Re-read on both look-and-feel changes (renderConfig) AND board changes (the
				// tilemap shape now carries infinite/seed), so the toggle reflects the shape
				// even when it is edited elsewhere or by another client.
				subscribe: (listener) => {
					const unsubConfig = renderConfigStore.subscribe(listener);
					const unsubStore = ctx.store.subscribe(listener);
					return () => {
						unsubConfig();
						unsubStore();
					};
				},
			});

			return () => {
				ctx.layers.unregister(TERRAIN_LAYER_ID);
				ctx.layers.unregister(BASE_LAYER_ID);
				ctx.layers.unregister(ENTER_BANNER_ID);
				unregisterMapHud();
				unregisterHud();
			};
		},
	};
}
