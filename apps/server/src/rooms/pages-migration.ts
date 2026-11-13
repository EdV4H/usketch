/**
 * クラウドボードのマルチページ移行（BoardRoom 側）。
 *
 * - 移行前のボード（ルート doc に `meta.pagesVersion` が無い）を開いたら、初回同期より前に 1 回だけ
 *   ルートの `shapes` を 1 枚目のページ doc へ移す。新しいボードも同じ手順で 1 枚目だけ作る
 * - 移行の前に履歴の自動コミットを 1 つ取る（移行前の中身はそのコミットから 1 枚目として戻せる）
 * - ページ doc を保存し終えてからルートを書き換えるので、途中で止まってもシェイプは消えない。
 *   1 枚目の id は先に storage に置き、やり直しでも同じページへ写す
 * - 移行後にルートの `shapes` へ書かれたシェイプ（古いクライアントなど）は 1 枚目へ移す
 *
 * 移行は機能フラグ（`enabled`）で閉じておける。閉じていても、移行後のボードへの書き込みの
 * 振り分けは行う（ページを使うボードのルート `shapes` は常に空にする）。
 */

import {
	copyRootShapesToPage,
	countRootShapes,
	finishPagesMigration,
	getLegacyPageId,
	isPagedBoard,
	moveRootShapesToPage,
	needsPagesMigration,
	newPageId,
} from "@edv4h/usketch-sync";
import type * as Y from "yjs";

/** 移行中の 1 枚目の id を置く storage のキー（移行が終わったら消す）。 */
export const PENDING_MIGRATION_KEY = "pages_migration_pending";

/** 移行・振り分けで使う、doc の保存の窓口（rooms/yjs-sync.ts の一部）。 */
interface DocSync {
	getOrCreateDoc(): Promise<{ doc: Y.Doc }>;
	pushUpdate(update: Uint8Array): void;
	save(): Promise<void>;
}

export interface PagesMigrationDeps {
	/** 移行を行うか（機能フラグ）。 */
	enabled: boolean;
	storage: Pick<DurableObjectStorage, "get" | "put" | "delete">;
	root: DocSync;
	/** ページ doc を読み込む・使い終える・購読者へ update を送る（rooms/page-docs.ts）。 */
	pageDocs: {
		load(docId: string): Promise<DocSync>;
		publish(docId: string, update: Uint8Array): void;
		release(docId: string): void;
	};
	/** サーバーで書き換えたルートの update を全接続へ送る（保存の予約もする）。 */
	broadcastRoot(update: Uint8Array): void;
	/** 移行の直前に履歴の自動コミットを取る。 */
	commitBeforeMigration?: () => Promise<unknown>;
	now?: () => number;
}

/** `edit` の中で doc に入った変更を 1 つの update にして返す（変更が無ければ null）。 */
async function captureUpdate(doc: Y.Doc, edit: () => void): Promise<Uint8Array | null> {
	const Y = await import("yjs");
	const updates: Uint8Array[] = [];
	const onUpdate = (update: Uint8Array) => updates.push(update);
	doc.on("update", onUpdate);
	try {
		edit();
	} finally {
		doc.off("update", onUpdate);
	}
	if (updates.length === 0) return null;
	return updates.length === 1 ? updates[0] : Y.mergeUpdates(updates);
}

export function createPagesMigration(deps: PagesMigrationDeps) {
	/** このインスタンスで移行を済ませたか（済んでいれば調べ直さない）。 */
	let migrated = false;
	let running: Promise<void> | null = null;
	let moving: Promise<void> | null = null;

	/** 1 枚目のページ doc に update を広め、すぐ保存する。 */
	async function writePage(pageId: string, edit: (doc: Y.Doc) => void): Promise<void> {
		const sync = await deps.pageDocs.load(pageId);
		try {
			const { doc } = await sync.getOrCreateDoc();
			const update = await captureUpdate(doc, () => edit(doc));
			if (update) {
				// 購読者へ送り、保存を予約する。そのうえで今すぐ保存して、ルートを変える前に残す
				deps.pageDocs.publish(pageId, update);
				await sync.save();
			}
		} finally {
			deps.pageDocs.release(pageId);
		}
	}

	async function migrate(): Promise<void> {
		const { doc: root } = await deps.root.getOrCreateDoc();
		if (!needsPagesMigration(root)) {
			migrated = true;
			return;
		}
		await deps.commitBeforeMigration?.();

		const pending = await deps.storage.get(PENDING_MIGRATION_KEY);
		const pageId = typeof pending === "string" ? pending : newPageId();
		if (pending !== pageId) await deps.storage.put(PENDING_MIGRATION_KEY, pageId);

		const sync = await deps.pageDocs.load(pageId);
		try {
			const { doc: pageDoc } = await sync.getOrCreateDoc();
			const pageUpdate = await captureUpdate(pageDoc, () => copyRootShapesToPage(root, pageDoc));
			if (pageUpdate) {
				// 購読者へ送って保存を予約し、ルートを変える前に今すぐ保存する
				deps.pageDocs.publish(pageId, pageUpdate);
				await sync.save();
			}
			// ページ doc を保存し終えたので、ルートにページと版を書いてルートの shapes を空にする
			const rootUpdate = await captureUpdate(root, () => {
				finishPagesMigration(root, pageDoc, { pageId, now: deps.now?.() });
			});
			if (rootUpdate) {
				deps.root.pushUpdate(rootUpdate);
				await deps.root.save();
				deps.broadcastRoot(rootUpdate);
			}
		} finally {
			deps.pageDocs.release(pageId);
		}
		await deps.storage.delete(PENDING_MIGRATION_KEY);
		migrated = true;
		console.info(`[BoardRoom] Migrated board to pages (first page ${pageId})`);
		// 写した後に書き換わったシェイプが残っていれば続けて移す
		await moveRootShapes();
	}

	/**
	 * 移行が要るボードなら移行する（機能フラグが閉じていれば何もしない）。初回同期・サーバーの
	 * 読み書きの前に呼ぶ。同時に呼ばれても移行は 1 回だけ。
	 */
	async function ensureMigrated(): Promise<void> {
		if (migrated || !deps.enabled) return;
		if (!running) {
			running = migrate().finally(() => {
				running = null;
			});
		}
		await running;
	}

	async function moveOnce(): Promise<void> {
		const { doc: root } = await deps.root.getOrCreateDoc();
		if (!isPagedBoard(root) || countRootShapes(root) === 0) return;
		const pageId = getLegacyPageId(root);
		if (!pageId) return;
		let move: ReturnType<typeof moveRootShapesToPage> = null;
		await writePage(pageId, (doc) => {
			move = moveRootShapesToPage(root, doc);
		});
		const pending = move as ReturnType<typeof moveRootShapesToPage>;
		if (!pending) return;
		const update = await captureUpdate(root, () => {
			pending.removeFromRoot();
		});
		if (update) {
			deps.root.pushUpdate(update);
			deps.broadcastRoot(update);
		}
	}

	/**
	 * ページを使うボードのルート `shapes` にシェイプがあれば、移行先のページ（1 枚目）へ移す。
	 * ルートへの update を受けた後に呼ぶ。同時に呼ばれたら、前の移動の後にもう一度だけ行う。
	 */
	async function moveRootShapes(): Promise<void> {
		const previous = moving;
		const next = (async () => {
			await previous?.catch(() => {});
			await moveOnce();
		})();
		moving = next;
		try {
			await next;
		} finally {
			if (moving === next) moving = null;
		}
	}

	return { ensureMigrated, moveRootShapes };
}
