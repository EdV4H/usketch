// createMapPlugin — registers the RPG map feature: the terrain MapLayer, the
// data-only `tilemap` shape, the foreground `map-icon` shape, the `map` tool
// (brush/eraser/fill/stamp), the on-canvas palette, and the Tweaks HUD settings.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { MAP_ICON_TYPE, mapIconShapeDefinition } from "./map-icon-shape.js";
import { MapTerrainLayer } from "./map-layer.js";
import { createMapToolDefinition } from "./map-tool.js";
import { MAP_TOOL_ID } from "./map-tool-id.js";
import type { ColorMode } from "./palette.js";
import { type LineStyle, renderConfigStore } from "./render-config.js";
import { createTileMapShapeDefinition, DEFAULT_TILE, TILEMAP_TYPE } from "./tilemap-shape.js";
import { MapPalette } from "./ui/palette.js";

export interface MapPluginOptions {
	/** Tile size in world units. Default 40 (matches the design grid). */
	tile?: number;
	defaultColorMode?: ColorMode;
	defaultLineStyle?: LineStyle;
}

const TERRAIN_LAYER_ID = "usketch-map:terrain";
const PALETTE_LAYER_ID = "usketch-map:palette";

export function createMapPlugin(options: MapPluginOptions = {}): UsketchPlugin {
	const tile = options.tile ?? DEFAULT_TILE;
	if (options.defaultColorMode || options.defaultLineStyle) {
		renderConfigStore.set({
			colorMode: options.defaultColorMode,
			lineStyle: options.defaultLineStyle,
		});
	}

	return {
		id: "usketch-plugin-map",
		name: "RPG マップ",

		setup(ctx: PluginContext) {
			// ── Shapes (tilemap = data-only substrate, map-icon = foreground) ──
			ctx.shapes.register(TILEMAP_TYPE, createTileMapShapeDefinition(tile));
			ctx.shapes.register(MAP_ICON_TYPE, mapIconShapeDefinition);

			// ── Terrain MapLayer (renders behind all shapes) ──
			ctx.layers.register({
				id: TERRAIN_LAYER_ID,
				order: 40,
				fixed: true,
				render: () => <MapTerrainLayer store={ctx.store} />,
			});

			// ── Tool ──
			ctx.tools.register(MAP_TOOL_ID, createMapToolDefinition(tile));

			// ── Palette (shown while the map tool is active) ──
			ctx.layers.register({
				id: PALETTE_LAYER_ID,
				order: 196,
				fixed: true,
				render: () => <MapPalette store={ctx.store} commands={ctx.commands} tile={tile} />,
			});

			// ── Tweaks as declarative HUD settings (mirror the palette) ──
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
				],
				get: (name) =>
					renderConfigStore.get()[name as keyof ReturnType<typeof renderConfigStore.get>],
				set: (name, value) => {
					if (name === "strokeScale") renderConfigStore.set({ strokeScale: Number(value) });
					else if (name === "colorMode") renderConfigStore.set({ colorMode: value as ColorMode });
					else if (name === "lineStyle") renderConfigStore.set({ lineStyle: value as LineStyle });
				},
				subscribe: renderConfigStore.subscribe,
			});

			return () => {
				ctx.layers.unregister(TERRAIN_LAYER_ID);
				ctx.layers.unregister(PALETTE_LAYER_ID);
				unregisterHud();
			};
		},
	};
}
