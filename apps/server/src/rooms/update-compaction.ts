/** Yjs update バッファの圧縮 */

// yjs を動的importするためのキャッシュ
let yjsModule: typeof import("yjs") | null = null;
async function getYjs(): Promise<typeof import("yjs")> {
	if (!yjsModule) {
		yjsModule = await import("yjs");
	}
	return yjsModule;
}

/**
 * `updates` を適用した状態を 1 件の update にまとめて返す。
 *
 * 一時的な Y.Doc（GC 有効）に全件を適用して `encodeStateAsUpdate` するので、
 * 上書きや削除で不要になった中身（シェイプを動かすたびに積まれる古い値など）は
 * 長さだけの GC 構造になる。今の状態はそのまま残り、依存先がまだ届いていない
 * update も pending として含まれる。適用できない（破損した）update は、
 * サーバーが Y.Doc を作るときと同じく読み飛ばす。
 */
export async function compactUpdates(updates: readonly Uint8Array[]): Promise<Uint8Array[]> {
	if (updates.length === 0) return [];
	const Y = await getYjs();
	const doc = new Y.Doc();
	try {
		for (const update of updates) {
			try {
				Y.applyUpdate(doc, update);
			} catch (e) {
				console.error("[BoardRoom] Corrupt Yjs update during compaction, skipping:", e);
			}
		}
		return [Y.encodeStateAsUpdate(doc)];
	} finally {
		doc.destroy();
	}
}

/**
 * 旧形式（update ごとの数値配列を JSON にしたもの）を読む。破損していれば空配列。
 * 以前は 1 キーにこの形で全履歴を保存していて、すぐに値のサイズ上限を超えていた。
 */
export function parseLegacyUpdates(stored: unknown): Uint8Array[] {
	if (typeof stored !== "string") return [];
	try {
		const arr = JSON.parse(stored) as number[][];
		return arr.map((a) => new Uint8Array(a));
	} catch {
		return [];
	}
}
