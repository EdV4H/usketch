/**
 * デッキ（山札）操作の純関数群。shape / store に依存しないのでユニットテスト容易。
 */

/** Fisher–Yates シャッフル。元配列は破壊せず新配列を返す。 */
export function shuffle<T>(cards: readonly T[]): T[] {
	const result = cards.slice();
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/** 一番上（index 0）を1枚引く。残りの配列と引いたカードを返す。空なら card=null。 */
export function drawTop<T>(cards: readonly T[]): { card: T | null; rest: T[] } {
	if (cards.length === 0) return { card: null, rest: [] };
	const [card, ...rest] = cards;
	return { card, rest };
}

/**
 * 上から `n` 枚引く。`n` は `[0, length]` にクランプするので、残り枚数より多く要求しても
 * 引けるだけ引く。`drawn` は先頭 `n` 枚（index 0 が一番上）、`rest` は残り。元配列は破壊しない。
 */
export function drawN<T>(cards: readonly T[], n: number): { drawn: T[]; rest: T[] } {
	const count = Math.max(0, Math.min(Math.floor(n), cards.length));
	return { drawn: cards.slice(0, count), rest: cards.slice(count) };
}
