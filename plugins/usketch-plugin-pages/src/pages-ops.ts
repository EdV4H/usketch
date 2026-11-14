// ページの操作。ページは複数の store（ページ doc）にまたがるので、BoardStore ではなく
// ルート doc とページ doc を受け取る純関数にする。ページ一覧の読み書き（作成・名前・並び・
// 削除・復元）は @edv4h/usketch-sync の関数をそのまま使う。
import type { ShapeData } from "@edv4h/usketch-shared";
import { cloneShapes } from "@edv4h/usketch-store";
import {
	createPage,
	getPage,
	listPages,
	PAGE_SHAPES_MAP_KEY,
	type PageDocHandle,
	type PageMeta,
} from "@edv4h/usketch-sync";
import type * as Y from "yjs";

/** ページ doc を開く（ホストの page-doc manager の `open`）。 */
export type OpenPageDoc = (pageId: string) => PageDocHandle;

/** 新しいページの名前の既定（「ページ N」で、使われていない一番小さい N）。 */
export function nextPageName(root: Y.Doc, prefix = "ページ"): string {
	const used = new Set(listPages(root, { includeDeleted: true }).map((p) => p.name));
	for (let n = listPages(root).length + 1; ; n++) {
		const name = `${prefix} ${n}`;
		if (!used.has(name)) return name;
	}
}

/** 複製したページの名前（「元の名前 のコピー」）。 */
export function copyName(name: string): string {
	return `${name || "ページ"} のコピー`;
}

/**
 * ページ doc の中身を別のページ doc へ複製する。シェイプは新しい id にし、複製したもの
 * どうしの参照（親子・コネクタ）は張り替える。複製した数を返す。
 */
export function copyPageContent(from: Y.Doc, to: Y.Doc): number {
	const shapes = [...from.getMap<ShapeData>(PAGE_SHAPES_MAP_KEY).values()];
	const { shapes: cloned } = cloneShapes(shapes);
	const target = to.getMap<ShapeData>(PAGE_SHAPES_MAP_KEY);
	to.transact(() => {
		for (const shape of cloned) target.set(shape.id, JSON.parse(JSON.stringify(shape)));
	});
	return cloned.length;
}

/**
 * ページを複製する。元のページの直後に新しいページを足し、中身（シェイプ）を写す。
 * 元のページは読み込みを待ってから写す。足したページを返す。
 */
export async function duplicatePage(
	root: Y.Doc,
	sourceId: string,
	openPageDoc: OpenPageDoc,
	options: { name?: string } = {},
): Promise<PageMeta> {
	const source = getPage(root, sourceId);
	if (!source || source.deletedAt !== undefined) throw new Error(`Page not found: ${sourceId}`);
	const from = openPageDoc(sourceId);
	try {
		await from.whenLoaded;
		const page = createPage(root, { name: options.name ?? copyName(source.name), after: sourceId });
		const to = openPageDoc(page.id);
		try {
			copyPageContent(from.doc, to.doc);
		} finally {
			to.release();
		}
		return page;
	} finally {
		from.release();
	}
}

/** 並び順で `pageId` の次（`step` = 1）・前（-1）のページ。端なら null。 */
export function neighborPage(root: Y.Doc, pageId: string, step: 1 | -1): PageMeta | null {
	const pages = listPages(root);
	const index = pages.findIndex((p) => p.id === pageId);
	if (index < 0) return null;
	return pages[index + step] ?? null;
}
