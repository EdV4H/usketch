/**
 * Local (this-tab) AI activity — the in-app AI agent (⌘K → `ai:request`) writes
 * shapes server-side, so unlike the MCP driver it has no awareness presence of its
 * own. Instead the plugin mirrors the agent's `ai:response`/`ai:status` events into
 * this small store, and the overlay renders it as a synthetic "AI" participant
 * (feature #960). Only the initiating tab sees it (the edits themselves still sync
 * to everyone via the shape store).
 */
export interface AiActivity {
	/** Shapes the AI just placed/edited (from `ai:response`). */
	shapeIds: string[];
}

export interface AiActivityStore {
	get(): AiActivity | null;
	set(next: AiActivity | null): void;
	subscribe(listener: () => void): () => void;
}

/**
 * Create a fresh AI-activity store. One is created per plugin `setup()` so activity
 * is scoped to that app instance — never shared across multiple `createApp()` /
 * Canvas instances in the same JS runtime, and a teardown can't clear another's.
 */
export function createAiActivityStore(): AiActivityStore {
	let current: AiActivity | null = null;
	const listeners = new Set<() => void>();
	return {
		get: () => current,
		set(next) {
			current = next;
			for (const l of listeners) l();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
