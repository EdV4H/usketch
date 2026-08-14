import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { ActivityOverlay } from "./activity-overlay.js";

const LAYER_ID = "usketch-presence-activity";

export interface PresenceActivityOptions {
	wsProvider: WsProviderHandle;
}

/**
 * Renders every OTHER participant's live selection / edit / marquee on the canvas
 * (feature #960) by reading the Yjs awareness `activity` field. This is a general
 * multiplayer capability — humans and the AI participant are drawn identically;
 * "AI" is just a participant whose `user.name` is "AI". Cursors + the Members
 * list already come free from `presence-cursor` / `presence-store`; this only
 * adds the selection/edit outlines.
 */
export function createPresenceActivityPlugin(options: PresenceActivityOptions): UsketchPlugin {
	const { wsProvider } = options;
	return {
		id: "usketch-plugin-presence-activity",
		name: "参加者アクティビティ",

		setup(ctx: PluginContext) {
			// Above terrain/base/shapes, alongside the sync divergence overlay (250).
			ctx.layers.register({
				id: LAYER_ID,
				order: 248,
				fixed: true,
				render: (renderCtx) => (
					<ActivityOverlay
						store={ctx.store}
						shapes={ctx.shapes}
						viewport={renderCtx.viewport}
						awareness={wsProvider.awareness}
					/>
				),
			});

			return () => {
				ctx.layers.unregister(LAYER_ID);
			};
		},
	};
}
