import { persistDocToIndexedDb } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
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
import * as Y from "yjs";
import { pageDocName } from "./board-pages.js";

/**
 * ローカルボード（IndexedDB だけに保存するボード）のマルチページ移行。
 * クラウドボードはサーバーが移行するので、クライアントでは行わない。
 *
 * ページ doc を IndexedDB に書いて読み直せることを確かめてから、ルートを書き換える。
 * 途中で閉じてもシェイプは消えず、次に開いたときに同じページへやり直す。
 */

/** 移行中の 1 枚目の id を置く localStorage のキー。 */
function pendingKey(boardId: string): string {
	return `usketch-pages-migration-${boardId}`;
}

function readPending(boardId: string): string | null {
	try {
		return localStorage.getItem(pendingKey(boardId));
	} catch {
		return null;
	}
}

function writePending(boardId: string, pageId: string | null): void {
	try {
		if (pageId) localStorage.setItem(pendingKey(boardId), pageId);
		else localStorage.removeItem(pendingKey(boardId));
	} catch {
		// 使えなければ、やり直しのときに別のページになるだけ
	}
}

/** IndexedDB に保存されたページ doc を読み直し、`ids` がすべて同じ中身で入っているか確かめる。 */
async function isPersisted(
	name: string,
	expected: Y.Map<unknown>,
	ids: string[],
): Promise<boolean> {
	const probe = new Y.Doc();
	const persistence = persistDocToIndexedDb(name, probe);
	try {
		await persistence.whenSynced;
		const saved = probe.getMap<unknown>("shapes");
		return ids.every((id) => JSON.stringify(saved.get(id)) === JSON.stringify(expected.get(id)));
	} finally {
		persistence.destroy();
		probe.destroy();
	}
}

/** 書いた中身が IndexedDB から読めるまで待つ。読めなければ例外。 */
async function waitPersisted(name: string, doc: Y.Doc, ids: string[]): Promise<void> {
	const shapes = doc.getMap<unknown>("shapes");
	for (let attempt = 0; attempt < 10; attempt++) {
		if (await isPersisted(name, shapes, ids)) return;
		await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
	}
	throw new Error(`Page doc was not persisted: ${name}`);
}

/** ページ doc を IndexedDB で開き、`edit` で書いて保存されるまで待つ。 */
async function writePageDoc(
	boardId: string,
	pageId: string,
	edit: (doc: Y.Doc) => string[],
): Promise<Y.Doc> {
	const name = pageDocName(boardId, pageId);
	const doc = new Y.Doc();
	const persistence = persistDocToIndexedDb(name, doc);
	try {
		await persistence.whenSynced;
		const ids = edit(doc);
		await waitPersisted(name, doc, ids);
		return doc;
	} finally {
		persistence.destroy();
	}
}

export interface LocalPagesMigrationResult {
	/** 移行した（ページ形式にした）なら 1 枚目の id。 */
	migratedTo: string | null;
	/** ルートの shapes から 1 枚目へ移したシェイプの数（移行後に書かれたもの）。 */
	moved: number;
}

/**
 * ローカルボードを開いたときに呼ぶ。`migrate` が true で移行前のボードなら 1 枚目へ移し、
 * ページを使うボードのルート `shapes` にシェイプが残っていれば 1 枚目へ移す。
 * `rootDoc` は IndexedDB から読み終えたルート doc。
 */
export async function migrateLocalBoard(
	boardId: string,
	rootDoc: Y.Doc,
	options: { migrate: boolean },
): Promise<LocalPagesMigrationResult> {
	let migratedTo: string | null = null;
	if (options.migrate && needsPagesMigration(rootDoc)) {
		const pageId = readPending(boardId) ?? newPageId();
		writePending(boardId, pageId);
		const ids = [...rootDoc.getMap<unknown>("shapes").keys()];
		const pageDoc = await writePageDoc(boardId, pageId, (doc) => {
			copyRootShapesToPage(rootDoc, doc);
			return ids;
		});
		try {
			finishPagesMigration(rootDoc, pageDoc, { pageId });
		} finally {
			pageDoc.destroy();
		}
		writePending(boardId, null);
		migratedTo = pageId;
	}

	let moved = 0;
	const legacy = getLegacyPageId(rootDoc);
	if (isPagedBoard(rootDoc) && legacy && countRootShapes(rootDoc) > 0) {
		let removeFromRoot: (() => number) | null = null;
		const pageDoc = await writePageDoc(boardId, legacy, (doc) => {
			const move = moveRootShapesToPage(rootDoc, doc);
			removeFromRoot = move?.removeFromRoot ?? null;
			return move?.ids ?? [];
		});
		try {
			moved = (removeFromRoot as (() => number) | null)?.() ?? 0;
		} finally {
			pageDoc.destroy();
		}
	}
	return { migratedTo, moved };
}
