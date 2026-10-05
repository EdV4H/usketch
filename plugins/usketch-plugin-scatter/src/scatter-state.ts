// Module-scoped reactive store backing the scatter HUD controls. App-local
// presentation state (never synced), same shape as the map plugin's stores.

export interface ScatterState {
	/** Registered pattern name (radial | scatter | unoverlap | grid | …). */
	pattern: string;
	/** Registered relation resolver name (connectors | children | …). */
	relation: string;
	spacing: number;
	animate: boolean;
	durationMs: number;
	/** How many new shapes the "spawn & scatter" action creates. */
	spawnCount: number;
}

export interface ReactiveStore<T> {
	get(): T;
	set(patch: Partial<T>): void;
	subscribe(listener: () => void): () => void;
}

function createReactiveStore<T extends object>(initial: T): ReactiveStore<T> {
	let state = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(patch) {
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

export const scatterStateStore = createReactiveStore<ScatterState>({
	pattern: "radial",
	relation: "connectors",
	spacing: 24,
	animate: true,
	durationMs: 450,
	spawnCount: 6,
});
