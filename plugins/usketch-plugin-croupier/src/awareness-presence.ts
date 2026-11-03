import type { CroupierPresence } from "./croupier-service.js";

/** The Yjs Awareness subset used here (same shape as y-protocols' `Awareness`). */
export interface PresenceAwareness {
	setLocalStateField(field: string, value: unknown): void;
	getLocalState(): Record<string, unknown> | null;
	getStates(): Map<number, Record<string, unknown>>;
	on(event: "change", listener: () => void): void;
	off(event: "change", listener: () => void): void;
}

/** Awareness field this adapter publishes the local user id under. */
export const CROUPIER_AWARENESS_FIELD = "croupier";

/**
 * Build a {@link CroupierPresence} from a Yjs awareness: publishes the local user
 * id, and reports a user online while any connected client publishes theirs.
 * Listeners only fire when the set of online users changes (not on every cursor
 * move), so table views are not rebuilt needlessly. Pass a getter for `userId` when
 * the user is known only later (e.g. after sign-in): the published id follows it.
 */
export function createAwarenessPresence(
	awareness: PresenceAwareness,
	userId: string | (() => string),
): CroupierPresence & { dispose(): void } {
	const currentId = () => (typeof userId === "function" ? userId() : userId);
	const publish = () => {
		const id = currentId();
		const field = awareness.getLocalState()?.[CROUPIER_AWARENESS_FIELD] as
			| { userId?: unknown }
			| undefined;
		if (field?.userId !== id)
			awareness.setLocalStateField(CROUPIER_AWARENESS_FIELD, { userId: id });
	};
	publish();

	const readOnline = (): Set<string> => {
		const ids = new Set<string>();
		for (const state of awareness.getStates().values()) {
			const field = state[CROUPIER_AWARENESS_FIELD] as { userId?: unknown } | undefined;
			if (typeof field?.userId === "string") ids.add(field.userId);
		}
		return ids;
	};
	let online = readOnline();
	const key = (ids: Set<string>) => [...ids].sort().join("\n");
	let lastKey = key(online);

	const listeners = new Set<() => void>();
	const onChange = () => {
		publish();
		const next = readOnline();
		const nextKey = key(next);
		online = next;
		if (nextKey === lastKey) return;
		lastKey = nextKey;
		for (const listener of listeners) listener();
	};
	awareness.on("change", onChange);

	return {
		isOnline: (id) => online.has(id),
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		dispose() {
			awareness.off("change", onChange);
			listeners.clear();
			awareness.setLocalStateField(CROUPIER_AWARENESS_FIELD, null);
		},
	};
}
