/**
 * 旧スナップショット API（`/snapshots`、canvas-filter の Time Travel 用）の保存データを消す。
 * 履歴は history-manager（`history:*`）に一本化したので、残っているデータは使われない。
 *
 * - `snapshot_state:<ts>`（チャンク保存。`:meta` と `:g<gen>:<n>`）
 * - `snapshot:<ts>`（さらに古い Y.snapshot 形式）
 * - `snapshots:index`（一覧。最後に消すので、途中で止まっても次回やり直せる）
 */
const LEGACY_SNAPSHOT_PREFIXES = ["snapshot_state:", "snapshot:", "snapshots:index"] as const;

/** DO storage の list / delete に一度に渡せるキーの数。 */
const BATCH = 128;

/** 旧スナップショットのキーを全部消し、消した数を返す。何もなければ list 3 回で終わる。 */
export async function deleteLegacySnapshots(storage: DurableObjectStorage): Promise<number> {
	let deleted = 0;
	for (const prefix of LEGACY_SNAPSHOT_PREFIXES) {
		for (;;) {
			const page = await storage.list({ prefix, limit: BATCH });
			if (page.size === 0) break;
			deleted += await storage.delete([...page.keys()]);
		}
	}
	return deleted;
}
