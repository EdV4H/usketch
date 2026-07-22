import { SET_VIEWPORT_LOD_EVENT } from "@edv4h/usketch-dom-renderer";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import {
	loadViewportLod,
	saveViewportLod,
	VIEWPORT_LOD_RATIO_MAX,
	VIEWPORT_LOD_RATIO_MIN,
} from "../lib/render-settings.js";

/**
 * Registers the viewport-LOD controls into the Control HUD (`ctx.actions`, the
 * backtick panel): a live toggle and a numeric "full-detail %" input. Changes
 * apply immediately via {@link SET_VIEWPORT_LOD_EVENT} and persist to
 * localStorage. Kept in the host app so the dom-renderer stays UI/storage-free.
 *
 * The dom-renderer gets its initial value from persisted settings at creation
 * (see `createDomRendererPlugin` in app.tsx), so these actions only handle live
 * adjustments.
 */
export function createViewportLodControlPlugin(): UsketchPlugin {
	return {
		id: "usketch-web-viewport-lod-control",
		name: "Viewport LOD Control",

		setup(ctx: PluginContext) {
			const settings = loadViewportLod();
			const apply = () => {
				saveViewportLod(settings);
				ctx.events.emit(SET_VIEWPORT_LOD_EVENT, {
					enabled: settings.enabled,
					ratio: settings.ratio,
				});
			};

			const offToggle = ctx.actions.register({
				id: "viewport-lod:toggle",
				label: "画角外をLOD表示",
				group: "表示",
				order: 0,
				isActive: () => settings.enabled,
				run: () => {
					settings.enabled = !settings.enabled;
					apply();
				},
			});

			const offRatio = ctx.actions.register({
				id: "viewport-lod:ratio",
				label: "本描画範囲(%)",
				group: "表示",
				order: 1,
				params: [
					{
						name: "pct",
						label: "%",
						type: "number",
						min: VIEWPORT_LOD_RATIO_MIN * 100,
						max: VIEWPORT_LOD_RATIO_MAX * 100,
						step: 5,
						default: Math.round(settings.ratio * 100),
					},
				],
				isEnabled: () => settings.enabled,
				run: ({ pct }) => {
					const ratio = Number(pct) / 100;
					if (!Number.isFinite(ratio)) return;
					settings.ratio = Math.min(
						VIEWPORT_LOD_RATIO_MAX,
						Math.max(VIEWPORT_LOD_RATIO_MIN, ratio),
					);
					apply();
				},
			});

			return () => {
				offToggle();
				offRatio();
			};
		},
	};
}
