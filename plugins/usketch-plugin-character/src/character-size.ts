// How big a character is drawn. The plugin still draws nothing: it turns this setting
// into a screen size (`CharacterRenderProps.size`, px) for the host's renderer, so every
// renderer (and every client) sizes the body the same way. Only the look — the physics
// treat a character as a point (`motion.maxStep` / `jump.height` are what it can climb).

/**
 * - `"screen"`: the same on-screen size at every zoom (a map pin). The default.
 * - `"world"`: a size in world units, so it scales with the ground (zooming out
 *   shrinks it like the terrain), kept within `minPx … maxPx` on screen.
 */
export type CharacterSizeScale = "screen" | "world";

export interface CharacterSize {
	scale: CharacterSizeScale;
	/** Body size: screen px for `"screen"`, world units for `"world"`. */
	value: number;
	/** `"world"` only: never drawn smaller than this, screen px (so it never vanishes). */
	minPx: number;
	/** `"world"` only: never drawn larger than this, screen px. */
	maxPx: number;
}

/** 36 px on screen at every zoom — what the plugin's own demo renderer always drew. */
export const DEFAULT_SIZE: CharacterSize = { scale: "screen", value: 36, minPx: 12, maxPx: 480 };

/** Largest `value` accepted (screen px or world units). */
export const MAX_SIZE_VALUE = 4096;

const SCALES: readonly CharacterSizeScale[] = ["screen", "world"];

const inRange = (v: number | undefined, fallback: number, min: number, max: number) =>
	v !== undefined && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Fill `s` from `base` and keep it usable (positive sizes, `minPx ≤ maxPx`). */
export function sanitizeSize(
	s: Partial<CharacterSize> | undefined,
	base: CharacterSize = DEFAULT_SIZE,
): CharacterSize {
	const scale = s?.scale !== undefined && SCALES.includes(s.scale) ? s.scale : base.scale;
	const value = inRange(s?.value, base.value, 1, MAX_SIZE_VALUE);
	const minPx = inRange(s?.minPx, base.minPx, 1, MAX_SIZE_VALUE);
	const maxPx = Math.max(minPx, inRange(s?.maxPx, base.maxPx, 1, MAX_SIZE_VALUE));
	return { scale, value, minPx, maxPx };
}

/** The screen size (px) to draw a character at, for the viewport `zoom`. */
export function characterSizePx(size: CharacterSize, zoom: number): number {
	if (size.scale === "screen") return size.value;
	const px = size.value * (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);
	return Math.min(size.maxPx, Math.max(size.minPx, px));
}
