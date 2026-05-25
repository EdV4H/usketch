export interface VisibilityStore {
	get(): boolean;
	set(value: boolean): void;
	subscribe(listener: () => void): () => void;
}

export function createVisibilityStore(storageKey: string): VisibilityStore {
	let value = (() => {
		try {
			return localStorage.getItem(storageKey) === "1";
		} catch {
			return false;
		}
	})();
	const listeners = new Set<() => void>();

	return {
		get: () => value,
		set: (next) => {
			if (value === next) return;
			value = next;
			try {
				localStorage.setItem(storageKey, next ? "1" : "0");
			} catch {
				// localStorage unavailable (private mode, SSR) — silently keep in-memory state.
			}
			for (const listener of listeners) listener();
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
