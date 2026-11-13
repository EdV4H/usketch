import type * as Y from "yjs";
import {
	BOARD_META_MAP_KEY,
	CURRENT_PAGES_VERSION,
	createPage,
	getPage,
	getPagesVersion,
	LEGACY_PAGE_ID_KEY,
	PAGE_SHAPES_MAP_KEY,
	PAGES_VERSION_KEY,
	type PageMeta,
} from "./pages.js";

/**
 * ページ形式にする前のボード（ルート doc の `shapes` にシェイプがある）を、
 * ページを使うボードにする移行。
 *
 * 手順（どこで止まってもシェイプは消えない）:
 * 1. {@link copyRootShapesToPage} でルートの `shapes` を 1 枚目のページ doc へ写し、ページ doc を保存する
 * 2. 保存が終わってから {@link finishPagesMigration} でルートにページと版を書き、写し終えたシェイプをルートから消す
 * 3. 移行後にルートへ書かれたシェイプ（古いクライアントなど）は {@link moveRootShapesToPage} で 1 枚目へ移す
 *
 * 移行は 1 つのボードに対して 1 か所（クラウドならサーバー、ローカルならそのクライアント）だけで行う。
 * 複数で同時に行うと 1 枚目が 2 つできる。
 */

/** 1 枚目のページの既定の名前。 */
export const DEFAULT_FIRST_PAGE_NAME = "ページ 1";

function rootShapes(root: Y.Doc): Y.Map<unknown> {
	return root.getMap<unknown>(PAGE_SHAPES_MAP_KEY);
}

function pageShapes(pageDoc: Y.Doc): Y.Map<unknown> {
	return pageDoc.getMap<unknown>(PAGE_SHAPES_MAP_KEY);
}

/** JSON として同じ値か（Y.Map に置くシェイプは JSON の値）。 */
function sameValue(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	const ka = Object.keys(a as object).filter(
		(k) => (a as Record<string, unknown>)[k] !== undefined,
	);
	const kb = Object.keys(b as object).filter(
		(k) => (b as Record<string, unknown>)[k] !== undefined,
	);
	if (ka.length !== kb.length) return false;
	return ka.every((k) =>
		sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
	);
}

/** まだページ形式になっていない（移行が要る）ボードか。 */
export function needsPagesMigration(root: Y.Doc): boolean {
	return getPagesVersion(root) === null;
}

/**
 * 手順 1: ルートの `shapes` を全部ページ doc の `shapes` へ写す（ルートはまだ変えない）。
 * 何度呼んでも同じ結果になる。写した数を返す。
 */
export function copyRootShapesToPage(root: Y.Doc, pageDoc: Y.Doc): number {
	const from = rootShapes(root);
	const to = pageShapes(pageDoc);
	let copied = 0;
	pageDoc.transact(() => {
		for (const [id, value] of from.entries()) {
			if (!sameValue(to.get(id), value)) to.set(id, structuredClone(value));
			copied++;
		}
	});
	return copied;
}

export interface FinishPagesMigrationOptions {
	/** 1 枚目のページ（手順 1 で写した先）の id。 */
	pageId: string;
	/** 1 枚目のページ名。省略時は {@link DEFAULT_FIRST_PAGE_NAME}。 */
	name?: string;
	/** 作成時刻（テスト用）。 */
	now?: number;
}

export interface FinishPagesMigrationResult {
	page: PageMeta;
	/** ルートから消したシェイプの数。 */
	removed: number;
	/** ページ doc と中身が違ったのでルートに残したシェイプの id（手順 1 の後に書き換わったもの）。 */
	leftInRoot: string[];
}

/**
 * 手順 2: ルートに 1 枚目のページと版・移行先を書き、ページ doc に同じ中身があるシェイプを
 * ルートから消す。ここまでを 1 つの update にする。手順 1 の後に書き換わったシェイプは
 * ルートに残すので、続けて {@link moveRootShapesToPage} で移す。
 * 既にページ形式のボードには使えない（例外）。
 */
export function finishPagesMigration(
	root: Y.Doc,
	pageDoc: Y.Doc,
	options: FinishPagesMigrationOptions,
): FinishPagesMigrationResult {
	if (!needsPagesMigration(root)) throw new Error("Board is already paged");
	const from = rootShapes(root);
	const copied = pageShapes(pageDoc);
	const meta = root.getMap<unknown>(BOARD_META_MAP_KEY);
	const leftInRoot: string[] = [];
	let removed = 0;
	const pages: PageMeta[] = [];
	root.transact(() => {
		pages.push(
			getPage(root, options.pageId) ??
				createPage(root, {
					id: options.pageId,
					name: options.name ?? DEFAULT_FIRST_PAGE_NAME,
					now: options.now,
				}),
		);
		meta.set(LEGACY_PAGE_ID_KEY, options.pageId);
		meta.set(PAGES_VERSION_KEY, CURRENT_PAGES_VERSION);
		for (const [id, value] of [...from.entries()]) {
			if (sameValue(copied.get(id), value)) {
				from.delete(id);
				removed++;
			} else {
				leftInRoot.push(id);
			}
		}
	});
	return { page: pages[0], removed, leftInRoot };
}

/** ルートの `shapes` に残っているシェイプの数（移行後は 0 のはず）。 */
export function countRootShapes(root: Y.Doc): number {
	return rootShapes(root).size;
}

/**
 * 移行後にルートの `shapes` へ書かれたシェイプを、移行先のページ（`getLegacyPageId`）の doc へ移す。
 * 2 つの doc にまたがるので、呼び出し側は `pageDoc` を保存してから `removeFromRoot()` を呼ぶ
 * （保存前に落ちてもルートに残るので、次の呼び出しでやり直せる）。移すものが無ければ null。
 */
export function moveRootShapesToPage(
	root: Y.Doc,
	pageDoc: Y.Doc,
): { ids: string[]; removeFromRoot: () => number } | null {
	const from = rootShapes(root);
	if (from.size === 0) return null;
	const to = pageShapes(pageDoc);
	const ids = [...from.keys()];
	pageDoc.transact(() => {
		for (const id of ids) {
			const value = from.get(id);
			if (!sameValue(to.get(id), value)) to.set(id, structuredClone(value));
		}
	});
	return {
		ids,
		removeFromRoot: () => {
			let removed = 0;
			root.transact(() => {
				for (const id of ids) {
					// 写した後にまた書き換わったものは残し、次の呼び出しで移す
					if (from.has(id) && sameValue(from.get(id), to.get(id))) {
						from.delete(id);
						removed++;
					}
				}
			});
			return removed;
		},
	};
}

export interface PagesMigrationCheck {
	/** 移行前のシェイプがすべて 1 枚目にあり、ルートが空なら true。 */
	ok: boolean;
	/** 移行前にあって 1 枚目に無いシェイプ。 */
	missing: string[];
	/** 1 枚目にあって中身が移行前と違うシェイプ。 */
	changed: string[];
	/** 移行後もルートに残っているシェイプの数。 */
	rootShapes: number;
	/** 1 枚目のシェイプの数。 */
	pageShapes: number;
}

/**
 * 移行を確かめる。`before` は移行前のルート `shapes` の中身（`toJSON()`）。
 * 移行の後、移行前にあったシェイプがすべて 1 枚目のページ doc に同じ中身であり、ルートが空なら ok。
 * 移行後に編集されたシェイプは `changed` に出るので、編集が入る前に確かめる。
 */
export function checkPagesMigration(
	before: Record<string, unknown>,
	root: Y.Doc,
	pageDoc: Y.Doc,
): PagesMigrationCheck {
	const page = pageShapes(pageDoc);
	const missing: string[] = [];
	const changed: string[] = [];
	for (const [id, value] of Object.entries(before)) {
		if (!page.has(id)) missing.push(id);
		else if (!sameValue(page.get(id), value)) changed.push(id);
	}
	const rootCount = countRootShapes(root);
	return {
		ok:
			missing.length === 0 && changed.length === 0 && rootCount === 0 && !needsPagesMigration(root),
		missing,
		changed,
		rootShapes: rootCount,
		pageShapes: page.size,
	};
}
