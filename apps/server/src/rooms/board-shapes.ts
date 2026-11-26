/**
 * サーバー側の機能（AI・サムネイルなど）がボードのシェイプを読み書きする入口。
 *
 * - ページを使わないボード（`meta.pagesVersion` が無い）はルート doc の `shapes`
 * - ページを使うボードは、指定したページ（省略時は先頭ページ）のページ doc の `shapes`
 *
 * 書いた update は `publish` で広める（保存・中継・履歴への通知まで）。使い終えたら
 * `release` を呼ぶ（誰も購読していないページ doc をメモリから外すため）。
 */
import { isPagedBoard, isValidDocId, listPages } from "@edv4h/usketch-sync";
import type * as Y from "yjs";

export interface ShapesTarget {
	/** 書き込み先のページ。ページを使わないボードは null。 */
	pageId: string | null;
	/** `shapes` を持つ doc。 */
	doc: Y.Doc;
	/** この doc に書いた update を広める。 */
	publish(update: Uint8Array): void;
	release(): void;
}

/** 指定したページが無い（削除済み・不正な id・ページを使わないボードに pageId を渡した）。 */
export class PageNotFoundError extends Error {
	constructor(readonly pageId: string) {
		super(`Page not found: ${pageId}`);
		this.name = "PageNotFoundError";
	}
}

export interface BoardShapesDeps {
	getRootDoc: () => Promise<{ doc: Y.Doc }>;
	/** ルート doc に書いた update を広める。 */
	publishRoot: (update: Uint8Array) => void;
	pageDocs: {
		load: (docId: string) => Promise<{ getOrCreateDoc: () => Promise<{ doc: Y.Doc }> }>;
		publish: (docId: string, update: Uint8Array) => void;
		release: (docId: string) => void;
	};
}

export function createBoardShapes(deps: BoardShapesDeps) {
	/**
	 * どのページの shapes を使うか。ページを使わないボードは null、`pageId` を省略すると先頭ページ。
	 * 指定したページが無ければ {@link PageNotFoundError}。
	 */
	async function resolve(pageId?: string | null): Promise<string | null> {
		const { doc: root } = await deps.getRootDoc();
		if (!isPagedBoard(root)) {
			if (pageId) throw new PageNotFoundError(pageId);
			return null;
		}
		const pages = listPages(root);
		if (!pageId) {
			const first = pages[0];
			if (!first) throw new PageNotFoundError("");
			return first.id;
		}
		if (!isValidDocId(pageId) || !pages.some((p) => p.id === pageId)) {
			throw new PageNotFoundError(pageId);
		}
		return pageId;
	}

	/**
	 * シェイプを読み書きする doc を開く。`pageId` を省略するとページを使うボードでは先頭ページ。
	 * 指定したページが無ければ {@link PageNotFoundError}。
	 */
	async function open(pageId?: string | null): Promise<ShapesTarget> {
		const target = await resolve(pageId);
		if (target === null) {
			const { doc: root } = await deps.getRootDoc();
			return { pageId: null, doc: root, publish: deps.publishRoot, release: () => {} };
		}
		const sync = await deps.pageDocs.load(target);
		const { doc } = await sync.getOrCreateDoc();
		return {
			pageId: target,
			doc,
			publish: (update) => deps.pageDocs.publish(target, update),
			release: () => deps.pageDocs.release(target),
		};
	}

	return { open, resolve };
}

export type BoardShapes = ReturnType<typeof createBoardShapes>;
