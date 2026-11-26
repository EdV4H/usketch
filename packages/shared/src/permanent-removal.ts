/**
 * 図形の永久削除。消した id をストアが覚えておき、古いコマンドの Undo・版の復元・同期で
 * 届いた古い更新などで同じ id が戻ってくるのを止める。ホストの「使うと無くなる共有物」向け。
 */
import type { BoardStore } from "./types/plugin.js";

/**
 * 図形を消し、その id を二度と戻さないと記録する（{@link BoardStore.removeShapePermanently}）。
 * コマンドではないので Undo に積まれない。古いストア（持たない）では何もせず `false`。
 */
export function removeShapePermanently(
	store: Pick<BoardStore, "removeShapePermanently">,
	id: string,
	opts?: { expectedType?: string },
): boolean {
	return store.removeShapePermanently?.(id, opts) ?? false;
}

/** この id が永久削除で記録済みか。古いストアは常に `false`。 */
export function isPermanentlyRemoved(
	store: Pick<BoardStore, "isPermanentlyRemoved">,
	id: string,
): boolean {
	return store.isPermanentlyRemoved?.(id) ?? false;
}
