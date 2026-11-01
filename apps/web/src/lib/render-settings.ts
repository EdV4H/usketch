/** Persisted, per-user render settings (localStorage). */

const VIEWPORT_LOD_KEY = "usketch:viewport-lod";

export interface ViewportLodSettings {
	/** Render off-screen shapes in simplified LOD form. */
	enabled: boolean;
	/** Full-detail region as a multiple of the viewport (1.2 = 120%). */
	ratio: number;
}

export const DEFAULT_VIEWPORT_LOD: ViewportLodSettings = { enabled: true, ratio: 1.2 };

/** Clamp to a sane, UI-representable range. */
export const VIEWPORT_LOD_RATIO_MIN = 0.5;
export const VIEWPORT_LOD_RATIO_MAX = 2;

export function loadViewportLod(): ViewportLodSettings {
	try {
		const raw = localStorage.getItem(VIEWPORT_LOD_KEY);
		if (raw) {
			const p = JSON.parse(raw) as Partial<ViewportLodSettings>;
			return {
				enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_VIEWPORT_LOD.enabled,
				ratio:
					typeof p.ratio === "number" && Number.isFinite(p.ratio)
						? Math.min(VIEWPORT_LOD_RATIO_MAX, Math.max(VIEWPORT_LOD_RATIO_MIN, p.ratio))
						: DEFAULT_VIEWPORT_LOD.ratio,
			};
		}
	} catch {
		// ignore malformed / unavailable storage
	}
	return { ...DEFAULT_VIEWPORT_LOD };
}

export function saveViewportLod(settings: ViewportLodSettings): void {
	try {
		localStorage.setItem(VIEWPORT_LOD_KEY, JSON.stringify(settings));
	} catch {
		// ignore quota / unavailable storage
	}
}

const VIEWPORT_CULL_KEY = "usketch:viewport-cull";

export interface ViewportCullSettings {
	/** Don't render shapes far outside the viewport at all. */
	enabled: boolean;
	/** Cull region as a multiple of the viewport (2 = 200%). */
	ratio: number;
}

export const DEFAULT_VIEWPORT_CULL: ViewportCullSettings = { enabled: true, ratio: 2 };

/** Clamp to a sane, UI-representable range. */
export const VIEWPORT_CULL_RATIO_MIN = 1;
export const VIEWPORT_CULL_RATIO_MAX = 5;

export function loadViewportCull(): ViewportCullSettings {
	try {
		const raw = localStorage.getItem(VIEWPORT_CULL_KEY);
		if (raw) {
			const p = JSON.parse(raw) as Partial<ViewportCullSettings>;
			return {
				enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_VIEWPORT_CULL.enabled,
				ratio:
					typeof p.ratio === "number" && Number.isFinite(p.ratio)
						? Math.min(VIEWPORT_CULL_RATIO_MAX, Math.max(VIEWPORT_CULL_RATIO_MIN, p.ratio))
						: DEFAULT_VIEWPORT_CULL.ratio,
			};
		}
	} catch {
		// ignore malformed / unavailable storage
	}
	return { ...DEFAULT_VIEWPORT_CULL };
}

export function saveViewportCull(settings: ViewportCullSettings): void {
	try {
		localStorage.setItem(VIEWPORT_CULL_KEY, JSON.stringify(settings));
	} catch {
		// ignore quota / unavailable storage
	}
}
