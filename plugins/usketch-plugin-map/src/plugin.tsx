// createMapPlugin — registers the RPG map feature: the terrain MapLayer, the
// data-only `tilemap` + `base-map` shapes, the base landmark-icon layer, the `map`
// tool (brush/eraser/fill/generate/base), and the Tweaks HUD settings. Landmark
// icons belong to bases (derived from radius), not a separate stamp step.
import { boardHeight, type PluginContext, type UsketchPlugin } from "@edv4h/usketch-shared";
import { BaseIconLayer } from "./base/base-icon-layer.js";
import { BaseAreaLayer } from "./base/base-layer.js";
import { BASE_MAP_TYPE, createBaseMapShapeDefinition } from "./base/base-map-shape.js";
import { EnterBanner } from "./base/enter-banner.js";
import { resolveTerritoryStyle, type TerritoryStyle } from "./base/territory-style.js";
import { DEFAULT_BASE_GEN, regionSizeOf, scaleForRegionSize, withBaseGen } from "./base-terrain.js";
import { genStateStore } from "./gen-state.js";
import { registerMapHud } from "./hud/register-map-hud.js";
import {
	disableInfiniteTerrain,
	enableInfiniteTerrain,
	getInfiniteGen,
	getInfiniteSeed,
	isInfiniteTerrainEnabled,
	setInfiniteGen,
} from "./infinite-terrain.js";
import { GROUND_OVERSCAN_EVENT, MapTerrainLayer, STAGE_3D_EVENT } from "./map-layer.js";
import { MapReliefLayer, RELIEF_LAYER_ID } from "./map-relief-layer.js";
import { createMapApi, mapService } from "./map-service.js";
import { createMapToolDefinition } from "./map-tool.js";
import { MAP_TOOL_ID } from "./map-tool-id.js";
import type { ColorMode } from "./palette.js";
import { createRangeEraseToolDefinition, RANGE_ERASE_TOOL_ID } from "./range-erase-tool.js";
import { createReactiveStore } from "./reactive-store.js";
import {
	clampGroundOverscan,
	detailConfigPatch,
	type LineStyle,
	type MapDetailField,
	type MapRenderConfig,
	renderConfigStore,
} from "./render-config.js";
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
	 * The base "territory" (領域) overlay is HEADLESS: pass `region.render` /
	 * `label.render` / `enterBanner.render` to draw the area / label / enter-banner
	 * (the plugin owns geometry + tracking, the host owns the look), plus `show`
	 * (`"base-mode"` default, or `"always"`). Omit a hook → that part isn't drawn.
	 */
	territory?: TerritoryStyle;
	/**
	 * Initial draw range / level of detail (ground overscan cap in a 3D view, whether the
	 * relief covers it, the relief's edge inset, the full-detail threshold). Omitted
	 * fields keep the defaults. Adjustable at runtime via the Control HUD "RPG マップ"
	 * settings or `getMapApi(...).renderConfig`.
	 */
	detail?: Partial<Pick<MapRenderConfig, MapDetailField>>;
}

const TERRAIN_LAYER_ID = "usketch-map:terrain";
const BASE_LAYER_ID = "usketch-map:base";
const BASE_ICON_LAYER_ID = "usketch-map:base-icons";
const ENTER_BANNER_ID = "usketch-map:enter-banner";

/** The map plugin's id (also its ground provider's id on the board's height). */
const MAP_PLUGIN_ID = "usketch-plugin-map";

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
	for (const [name, value] of Object.entries(options.detail ?? {})) {
		const patch = detailConfigPatch(name, value, renderConfigStore.get());
		if (patch) renderConfigStore.set(patch);
	}

	return {
		id: MAP_PLUGIN_ID,
		name: "RPG マップ",

		setup(ctx: PluginContext) {
			// ── Shapes (tilemap + base-map = data-only substrates). A base's landmark
			//    icon is NOT a shape: it's derived from the base and drawn by the
			//    BaseIconLayer below (so Select can't grab it). ──
			ctx.shapes.register(TILEMAP_TYPE, createTileMapShapeDefinition(tile));
			ctx.shapes.register(BASE_MAP_TYPE, createBaseMapShapeDefinition(tile));

			// Ground revealed past the viewport by a 3D view (Mode 7): the terrain extends
			// under it so the far edge isn't a bare box (see GROUND_OVERSCAN_EVENT). The
			// requested px is kept so changing the cap (render config) re-applies it.
			const overscan = createReactiveStore({ px: 0 });
			let requestedOverscan = 0;
			const applyOverscan = () =>
				overscan.set({
					px: clampGroundOverscan(requestedOverscan, renderConfigStore.get().groundOverscanMaxPx),
				});
			const offOverscan = ctx.events.on<{ px: number }>(GROUND_OVERSCAN_EVENT, (data) => {
				requestedOverscan = Number(data?.px);
				applyOverscan();
			});
			const offOverscanCap = renderConfigStore.subscribe(applyOverscan);

			// Whether a 3D view (Mode 7) is showing the board: the relief is only built then.
			// Seeded from the attribute Mode 7 sets, in case it was already on before us.
			const stage = createReactiveStore({
				active:
					typeof document !== "undefined" &&
					document.querySelector('[data-mode7-stage="on"]') !== null,
			});
			const offStage = ctx.events.on<{ active: boolean }>(STAGE_3D_EVENT, (data) => {
				stage.set({ active: data?.active === true });
			});

			// The board's height: the map's terrain is one ground provider. The cliffs are
			// drawn only while the map's ground is the one in use (another terrain, such as
			// the elevation field, can rank above it).
			const height = ctx.height ?? boardHeight(ctx.services);
			const ownsGround = createReactiveStore({ on: true });
			const syncOwner = () => {
				const owner = height.owner();
				const on = owner === null || owner === MAP_PLUGIN_ID;
				if (on !== ownsGround.get().on) ownsGround.set({ on });
			};

			// ── Terrain MapLayer (behind all shapes) ──
			ctx.layers.register({
				id: TERRAIN_LAYER_ID,
				view3d: "tilt",
				order: 40,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: (lctx) => (
					<MapTerrainLayer
						store={ctx.store}
						renderMode={lctx.renderMode}
						tile={tile}
						overscan={overscan}
					/>
				),
			});

			// ── Relief: the terrain's height as cliffs, shown only in a 3D view (Mode 7,
			//    where it is a depth layer). Above the flat terrain (40), below base
			//    areas / icons (42/44) so those stay visible. ──
			ctx.layers.register({
				id: RELIEF_LAYER_ID,
				view3d: "depth",
				order: 41,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: (lctx) => (
					<MapReliefLayer
						store={ctx.store}
						renderMode={lctx.renderMode}
						tile={tile}
						stage={stage}
						overscan={overscan}
						ownsGround={ownsGround}
					/>
				),
			});

			// ── Base areas (above terrain, below shapes) + enter banner overlay ──
			ctx.layers.register({
				id: BASE_LAYER_ID,
				view3d: "tilt",
				order: 42,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
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
				view3d: "tilt",
				order: 44,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: (lctx) => (
					<BaseIconLayer store={ctx.store} renderMode={lctx.renderMode} tile={tile} />
				),
			});
			// Enter banner (entry toast + current-area indicator) is HEADLESS: only
			// registered when the host supplies `territory.enterBanner.render`. The
			// layer tracks the current base; the host draws the look.
			const enterBannerRender = territoryStyle.enterBanner.render;
			if (enterBannerRender) {
				ctx.layers.register({
					id: ENTER_BANNER_ID,
					order: 197,
					fixed: true,
					render: () => <EnterBanner store={ctx.store} tile={tile} render={enterBannerRender} />,
				});
			}

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
					// How the world is generated (re-generates it): region size as a multiple
					// of the default (2 ⇒ regions twice as wide) and the sea level (0–1).
					{
						name: "regionSize",
						label: "領域の広さ",
						type: "number",
						min: 0.5,
						max: 4,
						step: 0.25,
					},
					{ name: "seaLevel", label: "海の割合", type: "number", min: 0, max: 1, step: 0.02 },
					// Draw range in a 3D view (Mode 7) + level of detail (see MapRenderConfig).
					{
						name: "groundOverscanMaxPx",
						label: "3D: 画面外の地面(px)",
						type: "number",
						min: 0,
						max: 2000,
						step: 20,
					},
					{ name: "reliefOverscan", label: "3D: 画面外の地面にも崖", type: "boolean" },
					{
						name: "reliefEdgeInset",
						label: "3D: 崖を作らない縁(マス)",
						type: "number",
						min: 0,
						max: 8,
						step: 1,
					},
					{
						name: "fullDetailMinPx",
						label: "詳細表示の最小マス(px)",
						type: "number",
						min: 4,
						max: 96,
						step: 2,
					},
				],
				get: (name) => {
					if (name === "emptyTerrain") return renderConfigStore.get().emptyTerrain ?? "none";
					// infinite/seed live on the tilemap SHAPE (persisted + synced), not on the
					// app-local render config — so the generated world survives reload.
					if (name === "infinite") return getInfiniteSeed(ctx.store) != null;
					if (name === "seed") return getInfiniteSeed(ctx.store) ?? genStateStore.get().seed;
					if (name === "regionSize" || name === "seaLevel") {
						// The board's params while on, else the ones chosen for turning it on.
						const gen =
							getInfiniteGen(ctx.store) ??
							withBaseGen(DEFAULT_BASE_GEN, genStateStore.get().baseGen ?? {});
						return name === "seaLevel" ? gen.seaLevel : Math.round(regionSizeOf(gen) * 100) / 100;
					}
					return renderConfigStore.get()[name as keyof ReturnType<typeof renderConfigStore.get>];
				},
				set: (name, value) => {
					const detail = detailConfigPatch(name, value, renderConfigStore.get());
					if (detail) renderConfigStore.set(detail);
					else if (name === "strokeScale") renderConfigStore.set({ strokeScale: Number(value) });
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
								gen: genStateStore.get().baseGen,
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
					} else if (name === "regionSize" || name === "seaLevel") {
						// Ignore junk; remember the choice for turning the terrain on, and
						// re-generate now when it's already on.
						const v = Number(value);
						if (!Number.isFinite(v) || (name === "regionSize" && v <= 0)) return;
						const patch =
							name === "seaLevel"
								? { seaLevel: Math.min(1, Math.max(0, v)) }
								: { scale: scaleForRegionSize(v) };
						genStateStore.set({ baseGen: { ...genStateStore.get().baseGen, ...patch } });
						setInfiniteGen(ctx.store, patch);
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
			const api = createMapApi(ctx.store, tile);
			const unprovideService = mapService.provide(ctx.services, api);
			// The board's ground height = the terrain's (a character can't climb cliffs).
			// Answered through the older `groundHeightService` too, by the board's height.
			const unregisterGround = height.register({
				id: MAP_PLUGIN_ID,
				kind: "ground",
				active: () => renderConfigStore.get().heightEnabled,
				heightAt: (x, y) => api.getHeightAt(x, y),
			});
			const offHeight = height.subscribe(syncOwner);
			// The map's own switch (`heightEnabled`) decides whether it answers at all.
			let lastHeightEnabled = renderConfigStore.get().heightEnabled;
			const offHeightSwitch = renderConfigStore.subscribe(() => {
				const on = renderConfigStore.get().heightEnabled;
				if (on === lastHeightEnabled) return;
				lastHeightEnabled = on;
				height.notify();
			});
			syncOwner();

			return () => {
				unregisterGround();
				offHeight();
				offHeightSwitch();
				unprovideService();
				offOverscan();
				offOverscanCap();
				offStage();
				ctx.layers.unregister(TERRAIN_LAYER_ID);
				ctx.layers.unregister(RELIEF_LAYER_ID);
				ctx.layers.unregister(BASE_LAYER_ID);
				ctx.layers.unregister(BASE_ICON_LAYER_ID);
				if (enterBannerRender) ctx.layers.unregister(ENTER_BANNER_ID);
				unregisterMapHud();
				unregisterHud();
			};
		},
	};
}
