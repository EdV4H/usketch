import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { ActivityOverlay } from "./activity-overlay.js";
import { createAiActivityStore } from "./ai-activity-store.js";
import { type PresenceActivityStyle, resolveActivityStyle } from "./style.js";

const LAYER_ID = "usketch-presence-activity";
/** How long the in-app AI highlight lingers after `ai:response` before clearing. */
const AI_HOLD_MS = 1600;

// Minimal local shapes of the in-app AI agent's events (see usketch-plugin-ai-agent).
interface AiResponseEvent {
	shapes: Array<{ id: string }>;
}
interface AiStatusEvent {
	status: "thinking" | "placing" | "done" | "error";
}

export interface PresenceActivityOptions {
	wsProvider: WsProviderHandle;
	/**
	 * Appearance overrides for the overlay (outline / marquee / badge / local-AI
	 * identity), or a full `renderParticipant` override. Merges over the defaults —
	 * omit for the stock look. See {@link PresenceActivityStyle}.
	 */
	style?: PresenceActivityStyle;
}

/**
 * Renders every OTHER participant's live selection / edit / marquee on the canvas
 * (feature #960) by reading the Yjs awareness `activity` field. This is a general
 * multiplayer capability — humans and the AI participant are drawn identically;
 * "AI" is just a participant whose `user.name` is "AI". Cursors + the Members
 * list already come free from `presence-cursor` / `presence-store`; this only
 * adds the selection/edit outlines.
 *
 * It also drives the LOCAL in-app AI: the ⌘K agent writes shapes server-side with
 * no awareness presence, so its `ai:response` is mirrored into `aiActivityStore`
 * and drawn as a synthetic "AI" participant on this tab.
 *
 * The host can restyle the indicators via `options.style` (outline / marquee /
 * badge / local-AI identity), or take over rendering entirely with
 * `style.renderParticipant`. See {@link PresenceActivityStyle}.
 */
export function createPresenceActivityPlugin(options: PresenceActivityOptions): UsketchPlugin {
	const { wsProvider } = options;
	const style = resolveActivityStyle(options.style);
	return {
		id: "usketch-plugin-presence-activity",
		name: "参加者アクティビティ",

		setup(ctx: PluginContext) {
			// Per-instance (not a module singleton) so activity never leaks between
			// multiple apps/canvases in the same runtime.
			const aiActivityStore = createAiActivityStore();

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
						style={style}
						aiActivityStore={aiActivityStore}
					/>
				),
			});

			// ── In-app AI driver (feature #960) ──
			// The ⌘K AI agent writes shapes server-side and has no awareness presence
			// of its own, so mirror its `ai:response` (shapes it placed) into the local
			// aiActivityStore — the overlay draws it as a synthetic "AI" participant on
			// this tab. Auto-clear after a short hold; drop on error.
			let clearTimer: ReturnType<typeof setTimeout> | null = null;
			const cancelTimer = () => {
				if (clearTimer) {
					clearTimeout(clearTimer);
					clearTimer = null;
				}
			};
			const offResponse = ctx.events.on<AiResponseEvent>("ai:response", (e) => {
				const ids = (Array.isArray(e.shapes) ? e.shapes : []).map((s) => s.id).filter(Boolean);
				if (ids.length === 0) return;
				aiActivityStore.set({ shapeIds: ids });
				cancelTimer();
				clearTimer = setTimeout(() => {
					aiActivityStore.set(null);
					clearTimer = null;
				}, AI_HOLD_MS);
			});
			const offStatus = ctx.events.on<AiStatusEvent>("ai:status", (e) => {
				if (e.status === "error") {
					cancelTimer();
					aiActivityStore.set(null);
				}
			});

			return () => {
				cancelTimer();
				aiActivityStore.set(null);
				offResponse();
				offStatus();
				ctx.layers.unregister(LAYER_ID);
			};
		},
	};
}
