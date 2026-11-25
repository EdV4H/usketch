/**
 * お試しボード（`/try`）に、前からあるローカルボード（`usketch-local-boards` の一覧）を
 * ページとして取り込む。1 ボード = 1 ページ（ページを使うボードはページごと）。
 *
 * - ページ doc を IndexedDB に書いて読み直せることを確かめてから、お試しボードのルート doc に
 *   ページを足す（途中で閉じてもシェイプは消えない）。
 * - 取り込んだボードはルート doc の `try-imports` に覚え、二度取り込まない。
 * - 画像などのアセット（ルート doc の `assets`）も写す。それ以外のボード単位のもの
 *   （ポータル・クルピエの状態など）は写さない。
 * - 元のボードの中身は IndexedDB に残す（一覧からは外す）。
 */
import { persistDocToIndexedDb } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import {
	createPage,
	getLegacyPageId,
	isPagedBoard,
	listPages,
	needsPagesMigration,
	newPageId,
	type PageMeta,
} from "@edv4h/usketch-sync";
import * as Y from "yjs";
import { pageDocName } from "./board-pages.js";
import { migrateLocalBoard, writePageDoc } from "./local-pages-migration.js";

/** ルート doc で、取り込んだボードを覚える Y.Map。 */
export const TRY_IMPORTS_MAP_KEY = "try-imports";
const ASSETS_MAP_KEY = "assets";
const SHAPES_MAP_KEY = "shapes";

/** ルート doc の IndexedDB の名前。 */
export function rootDocName(boardId: string): string {
	return `usketch-board-${boardId}`;
}

/** 取り込むページ。 */
export interface ImportedPage {
	name: string;
	preset?: string;
	plugins?: readonly string[];
	/** shape id → シェイプ（JSON）。 */
	shapes: Record<string, unknown>;
}

export function shapesOf(map: Y.Map<unknown>): Record<string, unknown> {
	const shapes: Record<string, unknown> = {};
	for (const [id, value] of map.entries()) shapes[id] = structuredClone(value);
	return shapes;
}

/**
 * ローカルボードのルート doc（と、読んでおいたページ doc の shapes）から、取り込むページを作る。
 * シェイプの無いページは取り込まない。ページを使うボードの 2 枚以上のページは
 * 「ボード名 / ページ名」にする。
 */
export function collectBoardPages(
	title: string,
	root: Y.Doc,
	pageShapes: ReadonlyMap<string, Record<string, unknown>>,
): ImportedPage[] {
	const rootShapes = shapesOf(root.getMap<unknown>(SHAPES_MAP_KEY));
	if (!isPagedBoard(root)) {
		return Object.keys(rootShapes).length > 0 ? [{ name: title, shapes: rootShapes }] : [];
	}
	const pages = listPages(root);
	// 古いクライアントがルートに書き残したシェイプは 1 枚目（移行したページ）のもの
	const legacy = getLegacyPageId(root) ?? pages[0]?.id;
	const many = pages.length > 1;
	const result: ImportedPage[] = [];
	pages.forEach((page: PageMeta, index) => {
		const shapes = {
			...(page.id === legacy ? rootShapes : {}),
			...(pageShapes.get(page.id) ?? {}),
		};
		if (Object.keys(shapes).length === 0) return;
		const pageName = page.name || `ページ ${index + 1}`;
		result.push({
			name: many ? `${title} / ${pageName}` : title,
			...(page.preset !== undefined ? { preset: page.preset } : {}),
			...(page.plugins !== undefined ? { plugins: page.plugins } : {}),
			shapes,
		});
	});
	return result;
}

/** もう取り込んだボードの id。 */
export function importedBoardIds(tryRoot: Y.Doc): Set<string> {
	return new Set(tryRoot.getMap<unknown>(TRY_IMPORTS_MAP_KEY).keys());
}

/**
 * 取り込んだページ（中身はもうページ doc に書いてある）をお試しボードのルート doc に足し、
 * 取り込んだボードを覚え、アセットを写す。1 つの transaction で書く。
 */
export function addImportedPages(
	tryRoot: Y.Doc,
	sourceId: string,
	pages: readonly { id: string; page: ImportedPage }[],
	assets: ReadonlyMap<string, unknown>,
	now = Date.now(),
): void {
	tryRoot.transact(() => {
		for (const { id, page } of pages) {
			createPage(tryRoot, {
				id,
				name: page.name,
				now,
				...(page.preset !== undefined ? { preset: page.preset } : {}),
				...(page.plugins !== undefined ? { plugins: page.plugins } : {}),
			});
		}
		const target = tryRoot.getMap<unknown>(ASSETS_MAP_KEY);
		for (const [key, value] of assets) {
			if (!target.has(key)) target.set(key, structuredClone(value));
		}
		tryRoot.getMap<unknown>(TRY_IMPORTS_MAP_KEY).set(sourceId, now);
	});
}

/** IndexedDB に保存した doc を開く。使い終わったら `close()` する。 */
export async function openDoc(name: string): Promise<{ doc: Y.Doc; close(): void }> {
	const doc = new Y.Doc();
	const persistence = persistDocToIndexedDb(name, doc);
	await persistence.whenSynced;
	return {
		doc,
		close() {
			persistence.destroy();
			doc.destroy();
		},
	};
}

/** IndexedDB に保存されたルート doc が `done` を満たすまで待つ。満たさなければ例外。 */
export async function waitRootPersisted(
	name: string,
	done: (doc: Y.Doc) => boolean,
): Promise<void> {
	for (let attempt = 0; attempt < 10; attempt++) {
		const probe = await openDoc(name);
		try {
			if (done(probe.doc)) return;
		} finally {
			probe.close();
		}
		await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
	}
	throw new Error(`Root doc was not persisted: ${name}`);
}

/** ルート doc に `sourceIds` が取り込み済みとして保存されるまで待つ。読めなければ例外。 */
function waitImportsPersisted(name: string, sourceIds: string[]): Promise<void> {
	return waitRootPersisted(name, (doc) => {
		const saved = importedBoardIds(doc);
		return sourceIds.every((id) => saved.has(id));
	});
}

export interface TryImportResult {
	/** 取り込んだ（もう取り込んであった、中身が空だったものを含む）ボードの id。 */
	boards: string[];
	/** 足したページの数。 */
	pages: number;
}

/** ローカルボードを、お試しボード `tryBoardId` のページとして取り込む。 */
export async function importLocalBoards(
	tryBoardId: string,
	sources: readonly { id: string; title: string }[],
): Promise<TryImportResult> {
	const result: TryImportResult = { boards: [], pages: 0 };
	if (sources.length === 0) return result;
	const target = await openDoc(rootDocName(tryBoardId));
	try {
		const tryRoot = target.doc;
		// お試しボードがまだページを使っていなければ、先にページの形にする
		if (needsPagesMigration(tryRoot)) {
			await migrateLocalBoard(tryBoardId, tryRoot, { migrate: true });
		}
		const done = importedBoardIds(tryRoot);
		for (const source of sources) {
			if (source.id === tryBoardId) continue;
			if (done.has(source.id)) {
				result.boards.push(source.id);
				continue;
			}
			const from = await openDoc(rootDocName(source.id));
			try {
				const pageShapes = new Map<string, Record<string, unknown>>();
				if (isPagedBoard(from.doc)) {
					for (const page of listPages(from.doc)) {
						const pageDoc = await openDoc(pageDocName(source.id, page.id));
						try {
							pageShapes.set(page.id, shapesOf(pageDoc.doc.getMap<unknown>(SHAPES_MAP_KEY)));
						} finally {
							pageDoc.close();
						}
					}
				}
				const pages = collectBoardPages(source.title, from.doc, pageShapes);
				const written: { id: string; page: ImportedPage }[] = [];
				for (const page of pages) {
					const id = newPageId();
					const doc = await writePageDoc(tryBoardId, id, (pageDoc) => {
						const shapes = pageDoc.getMap<unknown>(SHAPES_MAP_KEY);
						pageDoc.transact(() => {
							for (const [shapeId, value] of Object.entries(page.shapes)) {
								shapes.set(shapeId, value);
							}
						});
						return Object.keys(page.shapes);
					});
					doc.destroy();
					written.push({ id, page });
				}
				addImportedPages(
					tryRoot,
					source.id,
					written,
					new Map(from.doc.getMap<unknown>(ASSETS_MAP_KEY).entries()),
				);
				result.boards.push(source.id);
				result.pages += written.length;
			} finally {
				from.close();
			}
		}
		await waitImportsPersisted(
			rootDocName(tryBoardId),
			result.boards.filter((id) => !done.has(id)),
		);
	} finally {
		target.close();
	}
	return result;
}
