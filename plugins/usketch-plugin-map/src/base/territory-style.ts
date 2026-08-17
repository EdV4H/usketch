import type { ReactNode } from "react";
import type { BaseRegionAnchor } from "./base-ops.js";

/**
 * Host-facing appearance options for the base "territory" (領域) overlay drawn by
 * BaseAreaLayer. Everything is optional and merges over the defaults, so passing
 * `{}` keeps the stock look. Pass via `createMapPlugin({ territory })`.
 */
export interface TerritoryStyle {
	/** Per-cell translucent fill opacity (default 0.24). */
	fillOpacity?: number;
	/** Base-coloured strip drawn on the exposed edges of each region. */
	border?: {
		/** Strip thickness as a fraction of a tile (default 0.16). */
		ratio?: number;
		opacity?: number;
	};
	/** Dashed radius ring around each base's beacon cell. */
	ring?: {
		enabled?: boolean;
		strokeWidth?: number;
		/** SVG `stroke-dasharray` (default `"8 6"`). */
		dash?: string;
		opacity?: number;
	};
	/** Name-chip label at each region's centre. */
	label?: {
		enabled?: boolean;
		/**
		 * Custom label content for a region. The layer positions the returned node
		 * at the region centre (screen space); you own its look. Return `null` to
		 * draw no label for that region. Omit for the stock pill.
		 */
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
	fillOpacity: number;
	border: { ratio: number; opacity: number };
	ring: { enabled: boolean; strokeWidth: number; dash: string; opacity: number };
	label: { enabled: boolean; render?: (anchor: BaseRegionAnchor) => ReactNode };
	show: "base-mode" | "always";
}

/** The stock territory look (matches what shipped before the style option). */
export const DEFAULT_TERRITORY_STYLE: ResolvedTerritoryStyle = {
	fillOpacity: 0.24,
	border: { ratio: 0.16, opacity: 0.85 },
	ring: { enabled: true, strokeWidth: 2, dash: "8 6", opacity: 0.7 },
	label: { enabled: true },
	show: "base-mode",
};

/** Keep the default whenever an override value is `undefined` (avoids NaN downstream). */
function pick<T>(base: T, override: T | undefined): T {
	return override === undefined ? base : override;
}

export function resolveTerritoryStyle(style?: TerritoryStyle): ResolvedTerritoryStyle {
	const d = DEFAULT_TERRITORY_STYLE;
	return {
		fillOpacity: pick(d.fillOpacity, style?.fillOpacity),
		border: {
			ratio: pick(d.border.ratio, style?.border?.ratio),
			opacity: pick(d.border.opacity, style?.border?.opacity),
		},
		ring: {
			enabled: pick(d.ring.enabled, style?.ring?.enabled),
			strokeWidth: pick(d.ring.strokeWidth, style?.ring?.strokeWidth),
			dash: pick(d.ring.dash, style?.ring?.dash),
			opacity: pick(d.ring.opacity, style?.ring?.opacity),
		},
		label: {
			enabled: pick(d.label.enabled, style?.label?.enabled),
			render: style?.label?.render,
		},
		show: pick(d.show, style?.show),
	};
}
