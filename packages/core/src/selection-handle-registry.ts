import type { SelectionHandleProvider, SelectionHandleRegistry } from "@edv4h/usketch-shared";

/**
 * Registry of the handles plugins add to the selection UI (see
 * {@link SelectionHandleProvider}). The select tool reads it to draw, hit-test
 * and drag them; plugins only register.
 *
 * `getAll` is ordered by `priority` (highest first), ties in registration order,
 * and cached until the set changes, so the select tool can call it on every
 * pointer move.
 */
export function createSelectionHandleRegistry(): SelectionHandleRegistry {
	const entries = new Map<string, SelectionHandleProvider>();
	const listeners = new Set<() => void>();
	let sorted: readonly SelectionHandleProvider[] | null = null;

	function changed() {
		sorted = null;
		for (const l of listeners) l();
	}

	return {
		register(provider) {
			entries.delete(provider.id);
			entries.set(provider.id, provider);
			changed();
			return () => {
				if (entries.get(provider.id) === provider) {
					entries.delete(provider.id);
					changed();
				}
			};
		},

		unregister(id) {
			if (entries.delete(id)) changed();
		},

		get(id) {
			return entries.get(id);
		},

		getAll() {
			// Array.prototype.sort is stable, so ties keep registration order.
			sorted ??= [...entries.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
			return sorted;
		},

		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
