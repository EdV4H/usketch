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
			let changed = false;
			for (const k of Object.keys(patch) as (keyof T)[]) {
				if (patch[k] !== undefined && patch[k] !== state[k]) {
					changed = true;
					break;
				}
			}
			if (!changed) return;
			state = { ...state, ...patch };
			for (const l of listeners) l();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
