import type { ReactNode } from "react";
import type { BaseInfo } from "./base-map-shape.js";
import type { BaseRegionAnchor, TerritoryRegion } from "./base-ops.js";

/**
 * Snapshot the enter-banner layer hands to `enterBanner.render`. The plugin owns
 * the tracking (which base the viewport centre is in + entry transitions); the host
 * owns the look (an entry toast + a persistent current-area indicator).
 */
export interface EnterBannerState {
	/** Base under the viewport centre — the persistent current-area indicator, or null. */
	current: BaseInfo | null;
	/** Base JUST entered — show a transient toast; null once it has faded (~2.6s). */
	entered: BaseInfo | null;
	/** Bumps on each new entry, so the host can restart an entrance animation. */
	enteredKey: number;
}

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
	 * Draw the RPG "you entered <Base>'s area" feedback (entry toast + current-area
	 * indicator), shown while editing bases. The layer tracks the base under the
	 * viewport centre + entry transitions and calls `render`; the host returns the
	 * overlay content (position it yourself inside the full-screen layer). Omit →
	 * no enter banner is drawn (headless), matching `region`/`label`.
	 */
	enterBanner?: {
		render?: (state: EnterBannerState) => ReactNode;
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
	enterBanner: { render?: (state: EnterBannerState) => ReactNode };
	show: "base-mode" | "always";
}

/** Defaults: headless (no render hooks) + base-mode gating. */
export const DEFAULT_TERRITORY_STYLE: ResolvedTerritoryStyle = {
	region: {},
	label: {},
	enterBanner: {},
	show: "base-mode",
};

export function resolveTerritoryStyle(style?: TerritoryStyle): ResolvedTerritoryStyle {
	return {
		region: { render: style?.region?.render },
		label: { render: style?.label?.render },
		enterBanner: { render: style?.enterBanner?.render },
		show: style?.show ?? DEFAULT_TERRITORY_STYLE.show,
	};
}
