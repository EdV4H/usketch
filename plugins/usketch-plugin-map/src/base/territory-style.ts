import type { ReactNode } from "react";
import type { BaseRegionAnchor, TerritoryRegion } from "./base-ops.js";

/**
 * Host-facing appearance for the base "territory" (領域) overlay drawn by
 * BaseAreaLayer. The plugin is HEADLESS: it computes the territory + region
 * geometry and owns positioning / viewport-follow / z-order / `show`-gating /
 * redraw, but draws NOTHING by itself. The host supplies the look via `region`
 * (area) and `label` render hooks. Pass via `createMapPlugin({ territory })`.
 * Omit a hook to draw nothing for that part.
 */
export interface TerritoryStyle {
	/**
	 * Draw a whole region's AREA (fill / border / ring — however the host likes).
	 * Return SVG in WORLD coordinates (the layer applies the viewport transform).
	 * Return `null` to draw nothing for that region. Omit → no area is drawn.
	 */
	region?: {
		render?: (region: TerritoryRegion) => ReactNode;
	};
	/**
	 * Draw a region's label. The layer positions the returned node at the region
	 * centre (screen space); the host owns its look. Return `null` for no label on
	 * that region. Omit → no labels are drawn.
	 */
	label?: {
		render?: (anchor: BaseRegionAnchor) => ReactNode;
	};
	/**
	 * When to paint the territory overlay:
	 * - `"base-mode"` (default) — only while editing bases (map tool + base submode),
	 * - `"always"` — whenever any territory exists (e.g. showing areas to end users).
	 */
	show?: "base-mode" | "always";
}

export interface ResolvedTerritoryStyle {
	region: { render?: (region: TerritoryRegion) => ReactNode };
	label: { render?: (anchor: BaseRegionAnchor) => ReactNode };
	show: "base-mode" | "always";
}

/** Defaults: headless (no render hooks) + base-mode gating. */
export const DEFAULT_TERRITORY_STYLE: ResolvedTerritoryStyle = {
	region: {},
	label: {},
	show: "base-mode",
};

export function resolveTerritoryStyle(style?: TerritoryStyle): ResolvedTerritoryStyle {
	return {
		region: { render: style?.region?.render },
		label: { render: style?.label?.render },
		show: style?.show ?? DEFAULT_TERRITORY_STYLE.show,
	};
}
