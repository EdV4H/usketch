/**
 * ルート doc の `pages`（ページ一覧）への書き込みを確かめる。
 *
 * クライアントはページの追加・名前・並び・削除をルート doc に直接書く（pages プラグイン）。
 * DO はその update を適用するあいだ `pages` の変化を記録し、権限の無い変化を戻す:
 *
 * - ページを足す: `page.create` が要る（無ければ消す）
 * - ページを変える・消す: そのページの `page.manage` が要る（無ければ元に戻す）
 * - 非公開ページの名前: ルート doc では伏せる（空にする）。書かれた名前は本当の名前として
 *   D1 へ移す（`renamed` に返す）。
 *
 * update は適用した後なので、戻すのはサーバーの書き込みで行い、全員に送る。
 */
import { PAGES_MAP_KEY, toPageMeta } from "@edv4h/usketch-sync";
import type * as Y from "yjs";

/** `pages` の 1 つのキーの変化。 */
export interface PagesChange {
	pageId: string;
	action: "add" | "update" | "delete";
	/** 変わる前の値（add では undefined）。 */
	oldValue: unknown;
}

/** 権限の答え（呼ぶ側がページの公開範囲を引いて答える）。 */
export interface PagesGuardJudge {
	canCreate(): boolean;
	canManage(pageId: string): boolean;
	/** 名前を伏せるページ（非公開）か。 */
	isMasked(pageId: string): boolean;
}

/** 戻す・伏せる作業。 */
export interface PagesGuardResult {
	/** 元に戻すキー（undefined は消す）。 */
	revert: Map<string, unknown>;
	/** 伏せたページに書かれた名前（D1 の本当の名前にする）。 */
	renamed: Map<string, string>;
}

/** 記録を止めて、記録中に `pages` で変わったキーを返す。 */
export interface PagesRecorder {
	stop(): PagesChange[];
}

/** `pages` の変化を記録し始める（update の適用の前に呼び、適用の後に `stop`）。 */
export function startRecordingPages(root: Y.Doc): PagesRecorder {
	const pages = root.getMap<unknown>(PAGES_MAP_KEY);
	const changes = new Map<string, PagesChange>();
	const observer = (event: Y.YMapEvent<unknown>) => {
		for (const [pageId, change] of event.changes.keys) {
			const previous = changes.get(pageId);
			// 同じキーが何度も変わったら、最初の前の値を残す
			changes.set(pageId, {
				pageId,
				action: previous?.action === "add" ? "add" : change.action,
				oldValue: previous ? previous.oldValue : change.oldValue,
			});
		}
	};
	pages.observe(observer);
	let stopped = false;
	return {
		stop() {
			if (!stopped) {
				stopped = true;
				pages.unobserve(observer);
			}
			return [...changes.values()];
		},
	};
}

/** `run`（update の適用）のあいだに `pages` で変わったキーを集める。 */
export function recordPagesChanges(root: Y.Doc, run: () => void): PagesChange[] {
	const recorder = startRecordingPages(root);
	try {
		run();
	} finally {
		recorder.stop();
	}
	return recorder.stop();
}

/** 変化を権限に照らし、戻すもの・伏せるものを決める。 */
export function judgePagesChanges(
	root: Y.Doc,
	changes: readonly PagesChange[],
	judge: PagesGuardJudge,
): PagesGuardResult {
	const pages = root.getMap<unknown>(PAGES_MAP_KEY);
	const revert = new Map<string, unknown>();
	const renamed = new Map<string, string>();
	for (const change of changes) {
		const { pageId } = change;
		const allowed =
			change.action === "add" && change.oldValue === undefined
				? judge.canCreate()
				: judge.canManage(pageId);
		if (!allowed) {
			revert.set(pageId, change.oldValue);
			continue;
		}
		if (!pages.has(pageId) || !judge.isMasked(pageId)) continue;
		const page = toPageMeta(pages.get(pageId));
		if (page?.name) renamed.set(pageId, page.name);
	}
	return { revert, renamed };
}

/** 伏せる: 名前を空にする。 */
export function maskPageName(root: Y.Doc, pageId: string): string | null {
	const pages = root.getMap<unknown>(PAGES_MAP_KEY);
	const page = toPageMeta(pages.get(pageId));
	if (!page) return null;
	if (page.name) pages.set(pageId, { ...(pages.get(pageId) as object), name: "" });
	return page.name;
}

/** 伏せるのをやめる: 名前を戻す。 */
export function unmaskPageName(root: Y.Doc, pageId: string, name: string): boolean {
	const pages = root.getMap<unknown>(PAGES_MAP_KEY);
	if (!toPageMeta(pages.get(pageId))) return false;
	pages.set(pageId, { ...(pages.get(pageId) as object), name });
	return true;
}

/** {@link judgePagesChanges} の結果をルート doc に書く（呼ぶ側がトランザクションで包む）。 */
export function applyPagesGuard(root: Y.Doc, result: PagesGuardResult): void {
	const pages = root.getMap<unknown>(PAGES_MAP_KEY);
	for (const [pageId, value] of result.revert) {
		if (value === undefined) pages.delete(pageId);
		else pages.set(pageId, value);
	}
	for (const pageId of result.renamed.keys()) maskPageName(root, pageId);
}
