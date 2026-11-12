import { generateKeyBetween } from "fractional-indexing";
import type * as Y from "yjs";
import { isValidDocId } from "./protocol.js";

/**
 * マルチページの持ち方（ルート doc 側）。
 *
 * - ルート doc の `pages`（Y.Map: pageId → {@link PageMeta}）にページ一覧を置く。
 * - ルート doc の `meta.pagesVersion` があるボードは「ページを使うボード」。各ページの中身は
 *   ページごとの Y.Doc（guid `page:<pageId>`、中身は `shapes`）にあり、
 *   {@link WsProviderHandle.subscribeDoc} で pageId を doc id にして同期する。
 * - `pagesVersion` が無いボードは従来どおりルート doc の `shapes` を使う（ページ無しの使い方）。
 */

/** ルート doc でページ一覧を置く Y.Map のキー。 */
export const PAGES_MAP_KEY = "pages";
/** ルート doc でボード全体の設定を置く Y.Map のキー。 */
export const BOARD_META_MAP_KEY = "meta";
/** `meta` の中でページ形式の版を置くキー。 */
export const PAGES_VERSION_KEY = "pagesVersion";
/** 今のページ形式の版。 */
export const CURRENT_PAGES_VERSION = 1;
/** ページ doc の中でシェイプを置く Y.Map のキー（ルート doc と同じ名前）。 */
export const PAGE_SHAPES_MAP_KEY = "shapes";

export interface PageMeta {
	id: string;
	name: string;
	/** 並び順（fractional index。文字列の昇順で並べる）。 */
	order: string;
	createdAt: number;
	/** 削除した時刻。削除済みのページは一覧に出さない（一定期間は戻せる）。 */
	deletedAt?: number;
}

/** ページ doc の guid。 */
export function pageDocGuid(pageId: string): string {
	return `page:${pageId}`;
}

/** Y.Map に入っている値を {@link PageMeta} として読む。形が違えば null。 */
export function toPageMeta(value: unknown): PageMeta | null {
	if (!value || typeof value !== "object") return null;
	const v = value as Record<string, unknown>;
	if (typeof v.id !== "string" || !isValidDocId(v.id)) return null;
	if (typeof v.order !== "string") return null;
	const page: PageMeta = {
		id: v.id,
		name: typeof v.name === "string" ? v.name : "",
		order: v.order,
		createdAt: typeof v.createdAt === "number" ? v.createdAt : 0,
	};
	if (typeof v.deletedAt === "number") page.deletedAt = v.deletedAt;
	return page;
}

function pagesMap(root: Y.Doc): Y.Map<unknown> {
	return root.getMap<unknown>(PAGES_MAP_KEY);
}

function metaMap(root: Y.Doc): Y.Map<unknown> {
	return root.getMap<unknown>(BOARD_META_MAP_KEY);
}

/** ルート doc のページ形式の版。ページを使わないボードは null。 */
export function getPagesVersion(root: Y.Doc): number | null {
	const v = metaMap(root).get(PAGES_VERSION_KEY);
	return typeof v === "number" ? v : null;
}

function comparePages(a: PageMeta, b: PageMeta): number {
	if (a.order !== b.order) return a.order < b.order ? -1 : 1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** ページを並び順で返す。既定では削除済みを除く。 */
export function listPages(root: Y.Doc, options: { includeDeleted?: boolean } = {}): PageMeta[] {
	const pages: PageMeta[] = [];
	for (const [key, value] of pagesMap(root).entries()) {
		const page = toPageMeta(value);
		if (!page || page.id !== key) continue;
		if (page.deletedAt !== undefined && !options.includeDeleted) continue;
		pages.push(page);
	}
	return pages.sort(comparePages);
}

/** ページを 1 つ読む（削除済みも返す）。 */
export function getPage(root: Y.Doc, pageId: string): PageMeta | null {
	const page = toPageMeta(pagesMap(root).get(pageId));
	return page && page.id === pageId ? page : null;
}

/**
 * ページを使うボードか。版があり、削除されていないページが 1 枚以上あるときだけ true。
 * ページが 1 枚も無い状態は移行の途中か壊れたデータなので、ページ無しとして扱う。
 */
export function isPagedBoard(root: Y.Doc): boolean {
	return getPagesVersion(root) !== null && listPages(root).length > 0;
}

/** 新しい pageId を作る（doc id として使える文字だけ）。 */
export function newPageId(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

export interface CreatePageOptions {
	name: string;
	/** pageId。省略時は新しく作る。 */
	id?: string;
	/** このページの直後に入れる。省略・null なら末尾。 */
	after?: string | null;
	/** 作成時刻（テスト用）。省略時は Date.now()。 */
	now?: number;
}

/** ページを足す（ページ doc の中身は空）。足したページを返す。 */
export function createPage(root: Y.Doc, options: CreatePageOptions): PageMeta {
	const id = options.id ?? newPageId();
	if (!isValidDocId(id)) throw new Error(`Invalid page id: ${id}`);
	if (pagesMap(root).has(id)) throw new Error(`Page already exists: ${id}`);
	const pages = listPages(root);
	let before: string | null = null;
	let next: string | null = null;
	if (options.after) {
		const index = pages.findIndex((p) => p.id === options.after);
		if (index < 0) throw new Error(`Page not found: ${options.after}`);
		before = pages[index].order;
		next = pages[index + 1]?.order ?? null;
	} else {
		before = pages.at(-1)?.order ?? null;
	}
	const page: PageMeta = {
		id,
		name: options.name,
		order: generateKeyBetween(before, next),
		createdAt: options.now ?? Date.now(),
	};
	pagesMap(root).set(id, { ...page });
	return page;
}

/**
 * まだ何も無いボードをページを使うボードにする（1 枚目のページを作り、版を書く）。
 * ルート doc の `shapes` にシェイプがあるボードは移行が要るので、ここでは扱わずに例外にする。
 * 既にページを使うボードなら何もしないで先頭ページを返す。
 */
export function initPagedBoard(
	root: Y.Doc,
	options: { name: string; id?: string; now?: number },
): PageMeta {
	if (isPagedBoard(root)) return listPages(root)[0];
	if (root.getMap(PAGE_SHAPES_MAP_KEY).size > 0) {
		throw new Error("Board has shapes in the root doc; migrate it instead of initializing pages");
	}
	const created: PageMeta[] = [];
	root.transact(() => {
		created.push(createPage(root, options));
		metaMap(root).set(PAGES_VERSION_KEY, CURRENT_PAGES_VERSION);
	});
	return created[0];
}

/**
 * 開くページを決める。`requested`（URL の `?page=`）→ `lastOpened`（前回開いたページ）→
 * 先頭ページの順に、削除されていないページを選ぶ。ページが無ければ null。
 */
export function resolvePageId(
	pages: readonly PageMeta[],
	candidates: { requested?: string | null; lastOpened?: string | null },
): string | null {
	const live = pages.filter((p) => p.deletedAt === undefined);
	for (const id of [candidates.requested, candidates.lastOpened]) {
		if (id && live.some((p) => p.id === id)) return id;
	}
	return live[0]?.id ?? null;
}

/** ページ一覧と版の変化を購読する。 */
export function observePages(root: Y.Doc, onChange: () => void): () => void {
	const pages = pagesMap(root);
	const meta = metaMap(root);
	const handler = () => onChange();
	pages.observe(handler);
	meta.observe(handler);
	return () => {
		pages.unobserve(handler);
		meta.unobserve(handler);
	};
}
