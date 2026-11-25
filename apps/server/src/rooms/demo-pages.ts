/**
 * デモボード（もとは Lobby のボード）に、地域（Workshop・Gallery・Playground）のページを作る
 * （#1558 R6）。地域ボードの中身は持ってこない（2026-11-25 maruchan: 捨ててよい）。
 *
 * - デモボードの DO が、機能フラグ `DEMO_PAGES` が開いていれば最初の接続で 1 回だけ行う。
 * - 地域のページは決まった id（`region-<slug>`）の空のページ。中身はページを初めて開いた人が
 *   プリセットで用意する（map-terrain は標高の地形を置く）。もうあるページは作らない（冪等）。
 * - もとの Lobby のページ（1 枚目）は名前とプリセットを付け、地域のボードを指すゲート
 *   （`board-portal`）は地域のページを指すようにする。
 * - 元の地域ボードはそのまま残す（誰も開かなくなる）。
 */
import {
	createPage,
	getLegacyPageId,
	getPage,
	listPages,
	renamePage,
	setPagePlugins,
} from "@edv4h/usketch-sync";
import type * as Y from "yjs";

/** デモボード（もとは Lobby のボード）。 */
export const DEMO_BOARD_ID = "community-lobby";
/** デモボードの名前。 */
export const DEMO_BOARD_TITLE = "uSketch Demo";

export interface DemoRegion {
	boardId: string;
	slug: string;
	name: string;
	/** ページのプリセット（apps/web の `PAGE_PRESETS`）。 */
	preset: string;
}

/** デモボードの 1 枚目（もとの Lobby）。 */
export const DEMO_LOBBY: DemoRegion = {
	boardId: DEMO_BOARD_ID,
	slug: "lobby",
	name: "Lobby",
	preset: "map",
};

/** デモボードのページにする地域（並び順）。 */
export const DEMO_REGIONS: readonly DemoRegion[] = [
	{ boardId: "community-workshop", slug: "workshop", name: "Workshop", preset: "map" },
	{ boardId: "community-gallery", slug: "gallery", name: "Gallery", preset: "map" },
	{
		boardId: "community-playground",
		slug: "playground",
		name: "Playground",
		preset: "map-terrain",
	},
];

/** 地域のページ id（`/community/<slug>` からのリダイレクト先）。 */
export function regionPageId(slug: string): string {
	return `region-${slug}`;
}

/** 作り終えた印を置く storage のキー。 */
export const DEMO_PAGES_DONE_KEY = "demo_pages:v1";

const PORTAL_TYPE = "board-portal";
const SHAPES_MAP_KEY = "shapes";

export interface DemoPagesDeps {
	storage: Pick<DurableObjectStorage, "get" | "put">;
	getRoot(): Promise<Y.Doc>;
	/** サーバーとしてルート doc に書き、保存して全員に送る。 */
	writeRoot(write: (root: Y.Doc) => void): Promise<void>;
	/** ページ doc に書き、すぐ保存して購読者へ送る。 */
	writePage(pageId: string, edit: (doc: Y.Doc) => void): Promise<void>;
	/** D1 のボード名をデモボードの名前にする。 */
	renameBoard(title: string): Promise<void>;
}

/** 1 枚目のページの名前がまだ移行したときの名前（付け直してよい）か。 */
function isDefaultName(name: string): boolean {
	return name.trim() === "" || /^ページ\s*\d+$/.test(name.trim());
}

/**
 * ページ doc のゲートのうち、`targets`（ボード id → ページ id）のボードを指すものに `pageId` を
 * 付ける。付けたゲートの数を返す。
 */
export function retargetPortals(doc: Y.Doc, targets: ReadonlyMap<string, string>): number {
	const shapes = doc.getMap<unknown>(SHAPES_MAP_KEY);
	let count = 0;
	doc.transact(() => {
		for (const [id, value] of [...shapes.entries()]) {
			if (!value || typeof value !== "object") continue;
			const shape = value as Record<string, unknown>;
			if (shape.type !== PORTAL_TYPE || typeof shape.boardId !== "string") continue;
			const pageId = targets.get(shape.boardId);
			if (!pageId || shape.pageId === pageId) continue;
			shapes.set(id, { ...shape, pageId });
			count++;
		}
	});
	return count;
}

/** 1 枚目のページ（移行したページ、無ければ先頭）。 */
function firstPageId(root: Y.Doc): string | null {
	return getLegacyPageId(root) ?? listPages(root)[0]?.id ?? null;
}

/**
 * デモボードに地域のページを作る。作り終えていれば何もしない。作った地域の slug を返す。
 * ルート doc がまだページを使っていなければ（移行が閉じているなど）何もしない。
 */
export async function setupDemoPages(deps: DemoPagesDeps): Promise<string[]> {
	if (await deps.storage.get(DEMO_PAGES_DONE_KEY)) return [];
	const root = await deps.getRoot();
	const lobby = firstPageId(root);
	if (!lobby) return [];

	const created: string[] = [];
	await deps.writeRoot((r) => {
		for (const region of DEMO_REGIONS) {
			const pageId = regionPageId(region.slug);
			if (getPage(r, pageId)) continue;
			createPage(r, { id: pageId, name: region.name, preset: region.preset });
			created.push(region.slug);
		}
		// もとの Lobby のページ: 名前を変えていなければ付け、プリセットが無ければ付ける
		const page = getPage(r, lobby);
		if (!page) return;
		if (isDefaultName(page.name)) renamePage(r, lobby, DEMO_LOBBY.name);
		if (page.preset === undefined) setPagePlugins(r, lobby, { preset: DEMO_LOBBY.preset });
	});

	// Lobby のゲートで地域のボードを指すものは、地域のページへ
	const targets = new Map(DEMO_REGIONS.map((r) => [r.boardId, regionPageId(r.slug)] as const));
	await deps.writePage(lobby, (doc) => {
		retargetPortals(doc, targets);
	});
	await deps.renameBoard(DEMO_BOARD_TITLE);

	await deps.storage.put(DEMO_PAGES_DONE_KEY, Date.now());
	return created;
}
