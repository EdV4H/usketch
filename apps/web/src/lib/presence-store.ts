/**
 * Reactive store of online members (presence), shown in the Control HUD via the
 * presence panel plugin. The app feeds it from the Yjs awareness (`set()`); the
 * panel subscribes. Module-scoped so it exists before plugin setup; replaces the
 * old `globalThis.__usketchPresence` hand-off (no global).
 */
export type PresenceMemberValue = {
	clientId: number;
	name: string;
	color: string;
	status?: string;
};

const PRESENCE_PALETTE = [
	"var(--u-1)",
	"var(--u-2)",
	"var(--u-3)",
	"var(--u-4)",
	"var(--u-5)",
	"var(--u-6)",
];
const presenceColor = (clientId: number): string =>
	PRESENCE_PALETTE[clientId % PRESENCE_PALETTE.length] ?? "var(--u-1)";

export interface PresenceStore {
	getSnapshot(): { members: PresenceMemberValue[] };
	set(members: PresenceMemberValue[]): void;
	subscribe(listener: () => void): () => void;
}

export const presenceStore: PresenceStore = (() => {
	let snapshot: { members: PresenceMemberValue[] } = { members: [] };
	const listeners = new Set<() => void>();
	const sameMembers = (a: PresenceMemberValue[], b: PresenceMemberValue[]) =>
		a.length === b.length &&
		a.every((m, i) => {
			const n = b[i];
			return (
				n != null &&
				m.clientId === n.clientId &&
				m.name === n.name &&
				m.color === n.color &&
				m.status === n.status
			);
		});
	return {
		getSnapshot: () => snapshot,
		set(members: PresenceMemberValue[]) {
			// Keep referential stability so useSyncExternalStore doesn't loop when
			// the member set is unchanged.
			if (sameMembers(snapshot.members, members)) return;
			// Copy so the stored snapshot is immutable from the outside (a later
			// mutation of the caller's array can't silently change our state).
			snapshot = { members: [...members] };
			for (const l of listeners) l();
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
})();

/** Read other online members (excluding self) from a Yjs awareness. */
export function readPresenceMembers(awareness: {
	getStates: () => Map<number, Record<string, unknown>>;
	doc: { clientID: number };
}): PresenceMemberValue[] {
	const members: PresenceMemberValue[] = [];
	for (const [clientId, state] of awareness.getStates()) {
		if (clientId === awareness.doc.clientID) continue;
		const user = state.user as { name?: string; color?: string; status?: string } | undefined;
		members.push({
			clientId,
			name: user?.name ?? "Guest",
			color: user?.color ?? presenceColor(clientId),
			status: user?.status ?? (state.presenting === true ? "presenting" : "active"),
		});
	}
	return members;
}
