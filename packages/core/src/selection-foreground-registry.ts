import type { SelectionForeground, SelectionForegroundRegistry } from "@edv4h/usketch-shared";

/**
 * Registry for the canvas selection foreground (handles, bounding box, marquee).
 *
 * Resolution rules:
 * - Higher `priority` wins.
 * - On ties, the most-recently-registered entry wins (last-wins).
 * - Re-registering the same `id` replaces the previous entry and bumps it to
 *   the end of insertion order (so the new entry wins on tie).
 *
 * Listeners registered via `subscribe` are notified only when the active
 * entry actually changes (by referential identity).
 */
export function createSelectionForegroundRegistry(): SelectionForegroundRegistry {
	const entries = new Map<string, SelectionForeground>();
	const listeners = new Set<() => void>();
	let active: SelectionForeground | null = null;

	function computeActive(): SelectionForeground | null {
		let winner: SelectionForeground | null = null;
		for (const e of entries.values()) {
			if (!winner || e.priority >= winner.priority) winner = e;
		}
		return winner;
	}

	function refreshActive() {
		const next = computeActive();
		if (next === active) return;
		active = next;
		for (const l of listeners) l();
	}

	return {
		register(entry) {
			entries.delete(entry.id);
			entries.set(entry.id, entry);
			refreshActive();
			return () => {
				if (entries.get(entry.id) === entry) {
					entries.delete(entry.id);
					refreshActive();
				}
			};
		},

		unregister(id) {
			if (entries.delete(id)) refreshActive();
		},

		getActive() {
			return active;
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
