/**
 * Board メタ情報（タイトル / Cloud か Local か / id）を HUD に供給するための
 * 構造型。ホストアプリ（apps/web）が `globalThis.__usketchBoardMeta` に
 * この形のトラッカーを載せ、General パネルが購読して表示する。
 * `__usketchSyncStatus` と同じ「アプリ側が用意する外部データソース」パターン。
 */

export interface BoardMetaSnapshot {
	/** ボード id（未確定なら undefined）。 */
	id?: string;
	/** 表示名（未取得なら null）。 */
	name: string | null;
	/** Cloud ボードなら true、ローカル保存なら false。 */
	isCloud: boolean;
}

export interface BoardMetaTrackerLike {
	getSnapshot(): BoardMetaSnapshot;
	subscribe(listener: () => void): () => void;
}
