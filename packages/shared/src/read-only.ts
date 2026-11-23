/**
 * 読み取り専用のページ（見るだけの人）。ストアは閲覧者自身の書き込み（Shape の追加・変更・削除）を
 * 受け付けず、同期で届く他の人の変更や保存したものの読み込みだけを {@link applyExternal} で通す。
 * ツールは `readOnlySafe` のもの（選択・パンなど）だけを使える。
 */
import type { BoardStore, ToolDefinition } from "./types/plugin.js";

/** ストアが読み取り専用か。古いストア（`isReadOnly` を持たない）は書ける。 */
export function isReadOnly(store: Pick<BoardStore, "isReadOnly">): boolean {
	return store.isReadOnly?.() ?? false;
}

/**
 * 閲覧者のものではない変更（同期で届いた他の人の編集・保存したものの読み込み）を、読み取り専用の
 * ストアにも入れる。同期のプラグインはストアへ書くときにこれで包む。
 */
export function applyExternal<T>(store: Pick<BoardStore, "applyExternal">, fn: () => T): T {
	return store.applyExternal ? store.applyExternal(fn) : fn();
}

/** このツールを今のストアで使えるか（読み取り専用なら `readOnlySafe` のものだけ）。 */
export function isToolUsable(
	store: Pick<BoardStore, "isReadOnly">,
	tool: Pick<ToolDefinition, "readOnlySafe"> | undefined,
): boolean {
	if (!tool) return false;
	return !isReadOnly(store) || tool.readOnlySafe === true;
}
