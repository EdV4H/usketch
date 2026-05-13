import type {
	ExternalContent,
	ExternalContentHandler,
	ExternalContentHandlerCtx,
	ExternalContentOf,
	ExternalContentRegistry,
} from "@edv4h/usketch-shared";

/**
 * Registry for external-content handlers (drop / paste / URL).
 *
 * Resolution rules (mirror {@link createSelectionForegroundRegistry}):
 * - Filter by `kind`.
 * - Call each handler's `match`. Errors thrown by `match` are caught, logged
 *   via `console.error`, and treated as `false` so one misbehaving handler
 *   can't poison the rest of the registry.
 * - Among matching handlers, the highest `order` wins (default `0`).
 *   On ties the most-recently-registered handler wins (last-wins).
 * - Re-registering the same `id` replaces the previous entry and bumps it
 *   to the end of insertion order (so the new entry wins on tie).
 * - Exactly one handler's `handle` runs per dispatch (single-winner). If it
 *   throws or rejects the error is logged and the dispatch ends — the
 *   next-best handler is NOT tried, mirroring tldraw's `registerExternalContentHandler`.
 *
 * The handler context is built on each dispatch via `buildCtx`, so handlers
 * always see the host's current `store` / `commands` / etc.
 */
export function createExternalContentRegistry(
	buildCtx: () => ExternalContentHandlerCtx,
): ExternalContentRegistry {
	const handlers = new Map<string, ExternalContentHandler>();

	function pickWinner(
		content: ExternalContent,
		ctx: ExternalContentHandlerCtx,
	): ExternalContentHandler | null {
		let winner: ExternalContentHandler | null = null;
		for (const h of handlers.values()) {
			if (h.kind !== content.kind) continue;
			let matched = false;
			try {
				matched = h.match(content as ExternalContentOf<typeof h.kind>, ctx);
			} catch (err) {
				console.error(`[usketch] external-content handler ${h.id}.match threw:`, err);
				continue;
			}
			if (!matched) continue;
			const winnerOrder = winner?.order ?? 0;
			const currentOrder = h.order ?? 0;
			if (!winner || currentOrder >= winnerOrder) winner = h;
		}
		return winner;
	}

	return {
		register(handler) {
			const entry = handler as unknown as ExternalContentHandler;
			handlers.delete(entry.id);
			handlers.set(entry.id, entry);
			return () => {
				if (handlers.get(entry.id) === entry) {
					handlers.delete(entry.id);
				}
			};
		},

		unregister(id) {
			handlers.delete(id);
		},

		async dispatch(content) {
			const ctx = buildCtx();
			const winner = pickWinner(content as ExternalContent, ctx);
			if (!winner) return false;
			try {
				await winner.handle(content as ExternalContentOf<typeof winner.kind>, ctx);
			} catch (err) {
				console.error(`[usketch] external-content handler ${winner.id}.handle threw:`, err);
			}
			return true;
		},

		getHandlers() {
			return Array.from(handlers.values());
		},
	};
}
