/**
 * オンラインメンバー情報を HUD に供給するための構造型。ホストアプリ（apps/web）が
 * `globalThis.__usketchPresence` にこの形のトラッカーを載せ、Members パネルが購読して
 * アバターを表示する。`__usketchBoardMeta` / `__usketchSyncStatus` と同じ
 * 「アプリ側が用意する外部データソース」パターン。
 */

export interface PresenceMember {
	clientId: number;
	name: string;
	/** CSS color (アバター背景)。 */
	color: string;
	/** active / away / busy など。未設定なら undefined。 */
	status?: string;
}

export interface PresenceSnapshot {
	/** 自分を除くオンラインメンバー。 */
	members: PresenceMember[];
}

export interface PresenceTrackerLike {
	getSnapshot(): PresenceSnapshot;
	subscribe(listener: () => void): () => void;
}
