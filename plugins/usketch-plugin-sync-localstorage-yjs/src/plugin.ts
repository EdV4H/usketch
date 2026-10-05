import type { UsketchPlugin } from "@edv4h/usketch-shared";
import type * as Y from "yjs";
import { createYjsSync } from "./yjs-sync.js";

export interface SyncLocalstorageYjsOptions {
	/**
	 * IndexedDB のドキュメント名。ボード単位のキーに使える（複数ボードで衝突を避ける）。
	 * 値でも getter でも可。省略時は "usketch-default"（後方互換）。
	 */
	docName?: string | (() => string);
	/**
	 * 永続化を後付けする既存 Y.Doc。ホストが持つネットワーク provider 接続済みの doc を渡すと、
	 * 同一 doc に IndexedDB 永続化を共存させられる（オフライン耐性＋初期表示の高速化）。
	 * 未指定なら従来どおり内部で新規 doc を生成する。渡した doc は破棄しない（ホスト所有）。
	 */
	doc?: Y.Doc;
}

/** docName を解決する（getter を評価し、空文字/非文字列は undefined に落として既定へ委ねる）。 */
function resolveDocName(source: SyncLocalstorageYjsOptions["docName"]): string | undefined {
	const raw = typeof source === "function" ? source() : source;
	return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export function createSyncLocalstorageYjsPlugin(
	options?: SyncLocalstorageYjsOptions,
): UsketchPlugin {
	return {
		id: "usketch-plugin-sync-localstorage-yjs",
		name: "ローカル永続化 (Yjs + IndexedDB)",

		async setup(ctx) {
			const handle = createYjsSync(ctx.store, {
				docName: resolveDocName(options?.docName),
				doc: options?.doc,
			});

			// Wait for IndexedDB restoration before continuing plugin setup chain
			await handle.whenSynced;

			return () => {
				handle.destroy();
			};
		},
	};
}
