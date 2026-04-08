import type { Viewport } from "./geometry.js";

/**
 * Rendering modes that the LOD controller can switch between.
 *
 * - `interactive`: full-fidelity DOM rendering. GPU layer is OFF. Used while
 *   the user is editing at normal zoom levels.
 * - `lod`: simplified rendering. GPU layer claims what it can, DOM renders the
 *   remainder using each shape's `simplifiedComponent` (or a fallback box).
 *   Used when zoomed out or under heavy load.
 * - `gpu-only`: reserved for future use; GPU renders, DOM is OFF entirely.
 */
export type RenderMode = "interactive" | "lod" | "gpu-only";

/**
 * Snapshot passed to a LodPolicy on every tick. Policies inspect this and
 * return the mode they would like the renderer to be in.
 */
export interface LodPolicyContext {
	viewport: Viewport;
	shapeCount: number;
	/** Smoothed FPS over recent frames. */
	fps: number;
	/** Current mode — used by hysteresis-aware policies. */
	currentMode: RenderMode;
}

/**
 * A LodPolicy decides which RenderMode is appropriate given a context.
 * Policies should be hysteresis-aware to avoid mode flapping.
 */
export interface LodPolicy {
	readonly id: string;
	evaluate(ctx: LodPolicyContext): RenderMode;
}

/**
 * Public API for the LOD controller. Exposed via `app.lod` so external code
 * (devtools, debug HUD, custom plugins) can inspect or override the mode.
 */
export interface LodController {
	getMode(): RenderMode;
	/** Subscribe to mode changes. Returns an unsubscribe function. */
	onModeChange(listener: (mode: RenderMode) => void): () => void;
	/** Replace the active policy. */
	setPolicy(policy: LodPolicy): void;
	/** Manually pin the mode. Pass `null` to release the override. */
	setManualOverride(mode: RenderMode | null): void;
}
