import type { PluginContext, StoreEvent, UsketchPlugin } from "@edv4h/usketch-shared";
import { applyDeepLink } from "./apply.js";
import { decodeDeepLink, encodeDeepLink } from "./url-state.js";

/** Coalesce rapid selection changes (e.g. marquee) into a single URL write. */
const WRITE_DEBOUNCE_MS = 150;

/**
 * Deep-link plugin: keeps the URL in sync with the current selection and
 * restores selection/viewport from the URL on load — like Figma's `?node-id`.
 *
 * Framework-agnostic: it reads `window.location` and writes via
 * `history.replaceState`, so it needs no router. Selection is synced live;
 * an exact camera (`?x&y&zoom`) is only produced by an explicit "copy view
 * link" action, not on every pan.
 */
export function createDeepLinkPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-deep-link",
		name: "ディープリンク",

		setup(ctx: PluginContext) {
			if (typeof window === "undefined") return () => {};

			const store = ctx.store;
			// Suppress URL writes until the initial apply settles, so restoring a
			// selection from the URL doesn't immediately rewrite it (or clobber the
			// camera during the async wait-for-sync window).
			let applying = true;
			let writeTimer: ReturnType<typeof setTimeout> | null = null;

			const writeUrl = () => {
				const selection = [...store.getSelection()].filter((id) => store.getShape(id));
				const search = encodeDeepLink(window.location.search, { shapeIds: selection });
				const url = `${window.location.pathname}${search}${window.location.hash}`;
				window.history.replaceState(null, "", url);
			};

			const scheduleWrite = () => {
				if (applying) return;
				if (writeTimer) clearTimeout(writeTimer);
				writeTimer = setTimeout(writeUrl, WRITE_DEBOUNCE_MS);
			};

			// Announce a load-time camera claim so cooperating camera plugins (e.g.
			// start-position) defer to an explicit deep link. Loosely coupled: we emit
			// a plain `viewport:claimed` event — no dependency on any other plugin. On a
			// microtask so every plugin's listener is subscribed first, regardless of
			// registration order. Only claim when the URL actually pins a camera.
			if (decodeDeepLink(window.location.search).camera) {
				queueMicrotask(() =>
					ctx.events.emit("viewport:claimed", { source: "deep-link", priority: 100 }),
				);
			}

			// Restore selection/viewport from the URL (waits for CRDT sync if needed).
			const disposeApply = applyDeepLink(store, window.location.search, () => {
				applying = false;
			});

			// Live selection → URL.
			const offMutation = store.onMutation((e: StoreEvent) => {
				if (e.type === "selection:changed") scheduleWrite();
			});

			return () => {
				if (writeTimer) clearTimeout(writeTimer);
				offMutation();
				disposeApply();
			};
		},
	};
}
