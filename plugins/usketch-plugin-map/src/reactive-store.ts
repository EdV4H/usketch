// Minimal module-scoped reactive store (get/set/subscribe) for useSyncExternalStore.
// Used for plugin-local UI state (Tweaks, active tool mode) that is intentionally
// NOT synced across clients — it is presentation/interaction state, not board data.

export interface ReactiveStore<T> {
	get(): T;
	set(patch: Partial<T>): void;
	subscribe(listener: () => void): () => void;
}

export function createReactiveStore<T extends object>(initial: T): ReactiveStore<T> {
	let state = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(patch) {
			// Skip `undefined` keys so a partial update (e.g. only `lineStyle`) never
			// clobbers an unrelated field with `undefined`.
			const next = { ...state };
			let changed = false;
			for (const k of Object.keys(patch) as (keyof T)[]) {
				const v = patch[k];
				if (v !== undefined && v !== state[k]) {
					next[k] = v as T[keyof T];
					changed = true;
				}
			}
			if (!changed) return;
			state = next;
			for (const l of listeners) l();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
