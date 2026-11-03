/** Yjs update バッファの圧縮（切り捨てずに 1 件へマージする） */

/**
 * バッファがこの件数を超えたら 1 件にマージする。
 * 以前はここで古い update を捨てていたため、初期のシェイプ作成が失われていた。
 */
export const COMPACT_THRESHOLD = 500;

// yjs を動的importするためのキャッシュ
let yjsModule: typeof import("yjs") | null = null;
async function getYjs(): Promise<typeof import("yjs")> {
	if (!yjsModule) {
		yjsModule = await import("yjs");
	}
	return yjsModule;
}

/**
 * `updates` が閾値を超えていれば `Y.mergeUpdates` で 1 件にまとめた配列を返す。
 * マージは無損失（どの update も捨てない）なので、結果を適用した doc は元の
 * 全 update を適用した doc と同じ状態になる。閾値以下、またはマージに失敗した
 * 場合（破損 update を含むなど）は入力をそのまま返す。
 */
export async function compactUpdates(
	updates: readonly Uint8Array[],
	threshold = COMPACT_THRESHOLD,
): Promise<Uint8Array[]> {
	if (updates.length <= threshold) return [...updates];
	const Y = await getYjs();
	try {
		return [Y.mergeUpdates([...updates])];
	} catch (e) {
		console.error("[BoardRoom] Failed to compact Yjs updates, keeping them as-is:", e);
		return [...updates];
	}
}
