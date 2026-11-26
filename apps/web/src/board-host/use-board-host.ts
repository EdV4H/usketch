import type { AppInstance } from "@edv4h/usketch-core";
import { useRef, useState } from "react";
import type { BoardRuntime, PagesState } from "../lib/board-pages.js";
import { PAGE_PRESETS, type PresetId, pagePlugins, pagePreset } from "./page-presets.js";
import { type BoardSource, useBoardConnection } from "./use-board-connection.js";
import { type LastOpen, type PageAppOptions, usePageApp } from "./use-page-app.js";

export interface BoardHostOptions extends Omit<PageAppOptions, "board" | "pageId" | "plugins"> {
	source: BoardSource | null;
	/**
	 * プリセットの無いページ（とページを使わないボード）を開くプリセット。ページは
	 * `PageMeta.plugins`、無ければ `PageMeta.preset` のプラグインで開く。
	 */
	defaultPreset: PresetId;
	/**
	 * 開くページを選ぶ。ページを使わないボードは null、まだ決められない（URL のページが
	 * 届いていないなど）ときは undefined。
	 */
	pickPage: (pagesState: PagesState) => string | null | undefined;
}

export interface BoardHost {
	app: AppInstance | null;
	error: string | null;
	board: BoardRuntime | null;
	pagesState: PagesState | null;
	pageId: string | null | undefined;
	lastOpen: { readonly current: LastOpen | null };
}

/**
 * ボードを開くホスト。ボードの接続（ルート doc・保存・WebSocket・ページ doc）と、開いた
 * ページの App（カタログから選んだプラグイン）を持つ。デモボード（/）もボード（/boards・/local）も
 * これで開く。
 */
export function useBoardHost(options: BoardHostOptions): BoardHost {
	const [board, setBoard] = useState<BoardRuntime | null>(null);
	const [pagesState, setPagesState] = useState<PagesState | null>(null);
	const switchPageRef = useRef(options.switchPage);
	switchPageRef.current = options.switchPage;
	// ボードを移った直後は、前のボードが片付くまで 1 回だけ古い状態が残る。それは使わない。
	const current = board && board.boardId === options.source?.boardId ? board : null;
	const pageId = current && pagesState ? options.pickPage(pagesState) : undefined;
	// ページの App を先に宣言する: React は cleanup を宣言順に走らせるので、ボードを閉じる
	// ときは接続より先に App を壊せる。
	const page = pageId ? (pagesState?.pages.find((p) => p.id === pageId) ?? null) : null;
	const plugins = new Set(pagePlugins(page, options.defaultPreset));
	const preset = PAGE_PRESETS[pagePreset(page, options.defaultPreset)];
	const { app, error, lastOpen } = usePageApp({
		...options,
		board: current,
		pageId,
		plugins,
		host: { ...options.host, defaultPreset: options.defaultPreset },
		onCreated: (created, wiring) => {
			// ホストのもの（地域の決まった地形など）を先に
			options.onCreated?.(created, wiring);
			// 空のページを初めて開いたら、プリセットの「最初に置くもの」を置く（地形など）
			if (wiring.pageId && preset.setupEmptyPage && created.store.getShapes().size === 0) {
				preset.setupEmptyPage(created.store, wiring.pageId);
			}
		},
	});
	useBoardConnection(options.source, switchPageRef, setBoard, setPagesState);
	return { app, error, board: current, pagesState: current ? pagesState : null, pageId, lastOpen };
}
