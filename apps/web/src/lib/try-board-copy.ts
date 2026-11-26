/**
 * ログインしていない人が見ている公開ページを、お試しボード（`/try`）へ写す（「手元で試す」）。
 * 写したページは IndexedDB だけに保存し、サーバーには何も送らない。
 *
 * - 写すのはページのシェイプ（プラグインの状態もシェイプなので一緒に写る）、プリセット、
 *   プラグイン、シェイプが使うアセット（ルート doc の `assets`）。
 * - お試しボードがまだページを使っていなければ（初めて）、写したページを 1 枚目にする。
 */
import {
	createPage,
	getLegacyPageId,
	getPage,
	initPagedBoard,
	isPagedBoard,
	needsPagesMigration,
	newPageId,
	setPagePlugins,
} from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import { migrateLocalBoard, writePageDoc } from "./local-pages-migration.js";
import {
	type ImportedPage,
	openDoc,
	rootDocName,
	shapesOf,
	waitRootPersisted,
} from "./try-board-import.js";

const ASSETS_MAP_KEY = "assets";
const SHAPES_MAP_KEY = "shapes";

/** 写すもの。 */
export interface PageCopy {
	page: ImportedPage;
	/** asset id → アセット。 */
	assets: Map<string, unknown>;
}

/** シェイプ（入れ子の中も）が使うアセットの id（`assetId`）。 */
export function referencedAssetIds(shapes: Record<string, unknown>): Set<string> {
	const ids = new Set<string>();
	const visit = (value: unknown, depth: number) => {
		if (depth > 8 || value === null || typeof value !== "object") return;
		if (Array.isArray(value)) {
			for (const item of value) visit(item, depth + 1);
			return;
		}
		for (const [key, item] of Object.entries(value)) {
			if (key === "assetId" && typeof item === "string" && item) ids.add(item);
			else visit(item, depth + 1);
		}
	};
	for (const shape of Object.values(shapes)) visit(shape, 0);
	return ids;
}

/**
 * 開いているボードのルート doc とページ doc から、写すものを作る。ページが無ければ null。
 * 古いクライアントがルートに書き残したシェイプは、1 枚目（移行したページ）のものとして含める。
 */
export function collectPageCopy(root: Y.Doc, pageDoc: Y.Doc, pageId: string): PageCopy | null {
	const meta = isPagedBoard(root) ? getPage(root, pageId) : null;
	if (!meta) return null;
	const shapes = {
		...(getLegacyPageId(root) === pageId ? shapesOf(root.getMap<unknown>(SHAPES_MAP_KEY)) : {}),
		...shapesOf(pageDoc.getMap<unknown>(SHAPES_MAP_KEY)),
	};
	const source = root.getMap<unknown>(ASSETS_MAP_KEY);
	const assets = new Map<string, unknown>();
	for (const id of referencedAssetIds(shapes)) {
		const asset = source.get(id);
		if (asset !== undefined) assets.set(id, structuredClone(asset));
	}
	return {
		page: {
			name: meta.name || "ページ",
			...(meta.preset !== undefined ? { preset: meta.preset } : {}),
			...(meta.plugins !== undefined ? { plugins: meta.plugins } : {}),
			shapes,
		},
		assets,
	};
}

/**
 * お試しボードのルート doc に、中身を書き終えたページ `pageId` を足し、アセットを写す。
 * まだページを使っていない空のボードなら、そのページを 1 枚目にする。1 つの transaction で書く。
 */
export function addCopiedPage(tryRoot: Y.Doc, pageId: string, copy: PageCopy, now = Date.now()) {
	const { page } = copy;
	tryRoot.transact(() => {
		if (needsPagesMigration(tryRoot)) {
			initPagedBoard(tryRoot, { id: pageId, name: page.name, now });
			if (page.preset !== undefined || page.plugins !== undefined) {
				setPagePlugins(tryRoot, pageId, {
					...(page.preset !== undefined ? { preset: page.preset } : {}),
					...(page.plugins !== undefined ? { plugins: page.plugins } : {}),
				});
			}
		} else {
			createPage(tryRoot, {
				id: pageId,
				name: page.name,
				now,
				...(page.preset !== undefined ? { preset: page.preset } : {}),
				...(page.plugins !== undefined ? { plugins: page.plugins } : {}),
			});
		}
		const target = tryRoot.getMap<unknown>(ASSETS_MAP_KEY);
		for (const [key, value] of copy.assets) {
			if (!target.has(key)) target.set(key, structuredClone(value));
		}
	});
}

/** `copy` をお試しボード `tryBoardId` の新しいページとして保存し、そのページの id を返す。 */
export async function copyPageToTryBoard(tryBoardId: string, copy: PageCopy): Promise<string> {
	const name = rootDocName(tryBoardId);
	const target = await openDoc(name);
	const pageId = newPageId();
	try {
		const tryRoot = target.doc;
		// 前のシェイプがルートに残ったままのボードは、先にページの形にする（シェイプは 1 枚目へ）
		if (needsPagesMigration(tryRoot) && tryRoot.getMap<unknown>(SHAPES_MAP_KEY).size > 0) {
			await migrateLocalBoard(tryBoardId, tryRoot, { migrate: true });
		}
		const doc = await writePageDoc(tryBoardId, pageId, (pageDoc) => {
			const shapes = pageDoc.getMap<unknown>(SHAPES_MAP_KEY);
			pageDoc.transact(() => {
				for (const [shapeId, value] of Object.entries(copy.page.shapes)) shapes.set(shapeId, value);
			});
			return Object.keys(copy.page.shapes);
		});
		doc.destroy();
		addCopiedPage(tryRoot, pageId, copy);
		await waitRootPersisted(name, (saved) => getPage(saved, pageId) !== null);
	} finally {
		target.close();
	}
	return pageId;
}
