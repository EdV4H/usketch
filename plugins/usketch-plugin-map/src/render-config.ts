// Visual "Tweaks" for the map: colorful⇔mono, wobble⇔clean line, stroke width, and
// how far / how detailed the ground and the 3D relief are drawn.
// Module-scoped so shapes/layers can subscribe before plugin setup runs. This is
// look-and-feel state (app-local), not synced board data.
import { useSyncExternalStore } from "react";
import { FULL_MIN_PX } from "./lod.js";
import type { ColorMode } from "./palette.js";
import { createReactiveStore } from "./reactive-store.js";
import type { TerrainKey } from "./terrain.js";

export type LineStyle = "wobble" | "clean";

export interface MapRenderConfig {
	colorMode: ColorMode;
	lineStyle: LineStyle;
	/** Multiplier on the hand-drawn stroke width (design `--sw`, base 2.6px). */
	strokeScale: number;
	/**
	 * Terrain used for unset cells. When set (e.g. "water"), unpainted / off-map
	 * space renders and is judged as that terrain — an infinite sea with painted
	 * land on top. `null` = truly empty (transparent, prior behavior).
	 */
	emptyTerrain: TerrainKey | null;
	// ── Draw range / detail (3D view + LOD). Defaults keep the original behaviour. ──
	/**
	 * Most screen px of ground drawn past the viewport when a 3D view (Mode 7) reveals
	 * more (see `GROUND_OVERSCAN_EVENT`). Higher shows farther ground, at the cost of
	 * more cells to build and paint.
	 */
	groundOverscanMaxPx: number;
	/**
	 * Whether the 3D relief (cliffs) also covers that overscanned ground. Off: only the
	 * on-screen cells get relief, so the far ground a 3D view tips into sight stays flat.
	 */
	reliefOverscan: boolean;
	/** Cells kept flat along the edge of the drawn ground, so no cliff floats past it. */
	reliefEdgeInset: number;
	/**
	 * On-screen px per tile at/above which the map draws full detail (patterns, wobble,
	 * relief); below it the ground drops to flat merged blocks and the relief is off.
	 */
	fullDetailMinPx: number;
	/**
	 * Whether the terrain has heights at all (cliffs in 3D, the ground-height service's
	 * steps). Off, the map is a flat picture: another plugin owns the board's height
	 * (e.g. usketch-plugin-elevation turns it off on a board with an elevation field).
	 */
	heightEnabled: boolean;
}

/** Defaults for the draw-range / detail fields (the original fixed values). */
export const DEFAULT_GROUND_OVERSCAN_MAX_PX = 160;
export const DEFAULT_RELIEF_EDGE_INSET = 2;
export const DEFAULT_FULL_DETAIL_MIN_PX = FULL_MIN_PX;

export const renderConfigStore = createReactiveStore<MapRenderConfig>({
	colorMode: "color",
	lineStyle: "wobble",
	strokeScale: 1,
	emptyTerrain: null,
	groundOverscanMaxPx: DEFAULT_GROUND_OVERSCAN_MAX_PX,
	reliefOverscan: false,
	reliefEdgeInset: DEFAULT_RELIEF_EDGE_INSET,
	fullDetailMinPx: DEFAULT_FULL_DETAIL_MIN_PX,
	heightEnabled: true,
});

/**
 * The ground overscan actually drawn: the 3D view's requested `px`, capped at `maxPx`.
 * Non-finite or negative values count as 0.
 */
export function clampGroundOverscan(px: number, maxPx: number): number {
	const p = Number.isFinite(px) ? Math.max(0, px) : 0;
	const m = Number.isFinite(maxPx) ? Math.max(0, maxPx) : 0;
	return Math.min(p, m);
}

/** The draw-range / detail fields of {@link MapRenderConfig}. */
export type MapDetailField =
	| "groundOverscanMaxPx"
	| "reliefOverscan"
	| "reliefEdgeInset"
	| "fullDetailMinPx";

const nonNegative = (v: unknown, fallback: number): number => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.max(0, n) : fallback;
};

/**
 * A render-config patch for one draw-range / detail field from a loosely typed value (a
 * HUD field, a host call): numbers are coerced and kept in range, junk falls back to the
 * current value. `null` when `name` isn't one of these fields. Pure.
 */
export function detailConfigPatch(
	name: string,
	value: unknown,
	current: MapRenderConfig,
): Partial<MapRenderConfig> | null {
	switch (name) {
		case "groundOverscanMaxPx":
			return { groundOverscanMaxPx: Math.round(nonNegative(value, current.groundOverscanMaxPx)) };
		case "reliefOverscan":
			return { reliefOverscan: value === true || value === "true" };
		case "reliefEdgeInset":
			return { reliefEdgeInset: Math.floor(nonNegative(value, current.reliefEdgeInset)) };
		case "fullDetailMinPx": {
			const px = nonNegative(value, current.fullDetailMinPx);
			// 0 would make every zoom "full detail" (unbounded cells): keep at least 1px.
			return { fullDetailMinPx: Math.max(1, px) };
		}
		default:
			return null;
	}
}

/** Subscribe a component to the current Tweaks config. */
export function useRenderConfig(): MapRenderConfig {
	return useSyncExternalStore(
		renderConfigStore.subscribe,
		renderConfigStore.get,
		renderConfigStore.get,
	);
}
