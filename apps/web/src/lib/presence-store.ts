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
	/** マルチページ: その人が開いているページ（ページを使うボードだけ）。 */
	pageId?: string;
	/** そのページの名前。 */
	pageName?: string;
	/** 自分と同じページにいるか（ページを使わないボードでは常に true）。 */
	samePage?: boolean;
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
	/** マルチページ: そのページを開く（ホストが設定する。無ければ null）。 */
	openPage: ((pageId: string) => void) | null;
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
				m.status === n.status &&
				m.pageId === n.pageId &&
				m.pageName === n.pageName &&
				m.samePage === n.samePage
			);
		});
	return {
		openPage: null,
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

/**
 * Read other online members (excluding self) from a Yjs awareness.
 * マルチページ: `pageName` を渡すと、awareness の `page` から各人のページと名前、自分と同じ
 * ページにいるかを添える。
 */
export function readPresenceMembers(
	awareness: {
		getStates: () => Map<number, Record<string, unknown>>;
		doc: { clientID: number };
	},
	pageName?: (pageId: string) => string | null,
): PresenceMemberValue[] {
	const members: PresenceMemberValue[] = [];
	const states = awareness.getStates();
	const myPage = states.get(awareness.doc.clientID)?.page;
	for (const [clientId, state] of states) {
		if (clientId === awareness.doc.clientID) continue;
		const user = state.user as { name?: string; color?: string; status?: string } | undefined;
		const member: PresenceMemberValue = {
			clientId,
			name: user?.name ?? "Guest",
			color: user?.color ?? presenceColor(clientId),
			status: user?.status ?? (state.presenting === true ? "presenting" : "active"),
		};
		if (pageName && typeof state.page === "string") {
			member.pageId = state.page;
			member.pageName = pageName(state.page) ?? undefined;
			member.samePage = state.page === myPage;
		}
		members.push(member);
	}
	return members;
}
