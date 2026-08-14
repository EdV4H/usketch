/**
 * Local (this-tab) AI activity — the in-app AI agent (⌘K → `ai:request`) writes
 * shapes server-side, so unlike the MCP driver it has no awareness presence of its
 * own. Instead the plugin mirrors the agent's `ai:status`/`ai:response` events into
 * this small store, and the overlay renders it as a synthetic "AI" participant
 * (feature #960). Only the initiating tab sees it (the edits themselves still sync
 * to everyone via the shape store).
 */
export interface AiActivity {
	/** Shapes the AI just placed/edited (from `ai:response`). */
	shapeIds: string[];
}

let current: AiActivity | null = null;
const listeners = new Set<() => void>();

export const aiActivityStore = {
	get: (): AiActivity | null => current,
	set(next: AiActivity | null): void {
		current = next;
		for (const l of listeners) l();
	},
	subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
};
