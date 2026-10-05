// A base's landmark icon is DERIVED, not stored: by default it reflects the base's
// SIZE (its radius tier — a bigger territory reads as a grander settlement), and a
// base may override it with any ICONS key. This mirrors how territory.ts derives
// ownership rather than storing it, so nothing here writes per-cell state.
import type { BaseInfo } from "./base-map-shape.js";

/**
 * Radius → default settlement icon, ascending by `maxRadius`. The last entry is
 * the cap (its `maxRadius` is Infinity), so every radius resolves. Keys are ICONS
 * entries; the tiers are intentionally coarse (tent → town → castle).
 */
export const BASE_ICON_TIERS: readonly { maxRadius: number; icon: string }[] = [
	{ maxRadius: 8, icon: "tent" }, // 開拓地 / 野営
	{ maxRadius: 16, icon: "town" }, // 町
	{ maxRadius: Number.POSITIVE_INFINITY, icon: "castle" }, // 都市 / 城
];

/** Default icon for a base of the given radius (its settlement tier). */
export function baseIconFor(radius: number): string {
	for (const t of BASE_ICON_TIERS) if (radius <= t.maxRadius) return t.icon;
	return BASE_ICON_TIERS[BASE_ICON_TIERS.length - 1].icon;
}

/** The icon a base actually shows: its explicit override, else the radius tier. */
export function effectiveBaseIcon(info: Pick<BaseInfo, "radius" | "icon">): string {
	return info.icon ?? baseIconFor(info.radius);
}
