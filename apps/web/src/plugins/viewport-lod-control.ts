import { SET_VIEWPORT_LOD_EVENT } from "@edv4h/usketch-dom-renderer";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import {
	loadViewportLod,
	saveViewportLod,
	VIEWPORT_LOD_RATIO_MAX,
	VIEWPORT_LOD_RATIO_MIN,
} from "../lib/render-settings.js";

/**
 * Contributes the viewport-LOD settings to the Control HUD (`ctx.hud`, the
 * backtick panel) as a live, two-way settings group: an on/off toggle and a
 * "full-detail %" number. Edits apply immediately via {@link SET_VIEWPORT_LOD_EVENT}
 * and persist to localStorage. Kept in the host app so the dom-renderer stays
 * UI/storage-free.
 *
 * The dom-renderer gets its initial value from persisted settings at creation
 * (see `createDomRendererPlugin` in app.tsx); this only handles live edits.
 */
export function createViewportLodControlPlugin(): UsketchPlugin {
	return {
		id: "usketch-web-viewport-lod-control",
		name: "画角外LOD",

		setup(ctx: PluginContext) {
			const settings = loadViewportLod();
			const listeners = new Set<() => void>();

			const apply = () => {
				saveViewportLod(settings);
				ctx.events.emit(SET_VIEWPORT_LOD_EVENT, {
					enabled: settings.enabled,
					ratio: settings.ratio,
				});
				for (const l of listeners) l(); // notify HUD controls to re-read
			};

			return ctx.hud.registerSettings({
				id: "viewport-lod:settings",
				fields: [
					{ name: "enabled", label: "画角外をLOD表示", type: "boolean" },
					{
						name: "pct",
						label: "本描画範囲(%)",
						type: "number",
						min: VIEWPORT_LOD_RATIO_MIN * 100,
						max: VIEWPORT_LOD_RATIO_MAX * 100,
						step: 5,
					},
				],
				get: (name) => {
					if (name === "enabled") return settings.enabled;
					if (name === "pct") return Math.round(settings.ratio * 100);
					return undefined; // unknown field — fail safe rather than aliasing to ratio
				},
				set: (name, value) => {
					if (name === "enabled") {
						settings.enabled = Boolean(value);
					} else if (name === "pct") {
						const ratio = Number(value) / 100;
						if (!Number.isFinite(ratio)) return;
						settings.ratio = Math.min(
							VIEWPORT_LOD_RATIO_MAX,
							Math.max(VIEWPORT_LOD_RATIO_MIN, ratio),
						);
					} else {
						return; // unknown field — ignore
					}
					apply();
				},
				subscribe: (cb) => {
					listeners.add(cb);
					return () => listeners.delete(cb);
				},
			});
		},
	};
}
