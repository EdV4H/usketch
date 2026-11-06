/** 最小の外部ストア (useSyncExternalStore 用)。 */
export interface ReactiveStore<T> {
	get(): T;
	set(next: T | ((prev: T) => T)): void;
	subscribe(listener: () => void): () => void;
}

export function createReactiveStore<T>(initial: T): ReactiveStore<T> {
	let value = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => value,
		set(next) {
			const resolved = typeof next === "function" ? (next as (prev: T) => T)(value) : next;
			if (Object.is(resolved, value)) return;
			value = resolved;
			for (const fn of listeners) fn();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
