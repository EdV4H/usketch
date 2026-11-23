import type { BoardStore } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import type { BoardRuntime } from "../lib/board-pages.js";
import { getDevUser } from "../lib/dev-auth.js";
import type { PresetId } from "./page-presets.js";

/** 発表（presentation プラグイン）を使うホストが渡すもの。 */
export interface PresentationWiring {
	getMode: () => "off" | "edit" | "present";
	navigateToBoard: () => void;
	getViewportSize: () => { width: number; height: number };
}

/** ホストごとに違うところ。カタログのエントリが読む。 */
export interface HostOptions {
	/** HUD にページパネル（一覧・追加・切り替え・ページのプラグイン）を出すか。 */
	pagesPanel?: boolean;
	/** プリセットの無いページ（とページを使わないボード）のプリセット。 */
	defaultPreset?: PresetId;
	/** 発表モードを使うホストだけが渡す。無ければ presentation プラグインは読まない。 */
	presentation?: PresentationWiring;
	/** 画面を移る（ボードポータル・ボード情報パネルから別のボードへ）。 */
	navigate?: (path: string) => void;
}

/** ログインしている人（していなければ id は null）。 */
export interface HostUser {
	id: string | null;
	name: string | null;
	image: string | null;
}

/**
 * プラグインを作るときにホストが渡す配線。カタログのエントリはここだけを見て
 * プラグインを作る（ホストの React の状態や URL は知らない）。
 */
export interface HostWiring {
	board: BoardRuntime;
	boardId: string;
	/** 開いているページ。ページを使わないボードは null。 */
	pageId: string | null;
	/** このページの BoardStore。 */
	store: BoardStore;
	/** プラグインに渡す接続（ページを使うボードでは同じページの人だけが見える）。接続の無いボードは null。 */
	wsProvider: WsProviderHandle | null;
	apiUrl: string;
	/** API に添えるヘッダー（開発中の X-User-Id）。 */
	extraHeaders: Record<string, string>;
	/** 今ログインしている人。ログインはボードの後に届くことがあるので、毎回呼んで読む。 */
	user: () => HostUser;
	/** ページを切り替える（URL を変える。ボードの接続はそのまま）。 */
	switchPage: (pageId: string) => void;
	host: HostOptions;
	/** App を壊すときに一緒に片付けるもの。 */
	onDispose: (dispose: () => void) => void;
}

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

/** 開発中は `X-User-Id` で誰として API を呼ぶかを決める（本番は cookie）。 */
export function devHeaders(): Record<string, string> {
	const headers: Record<string, string> = {};
	if (import.meta.env.DEV) {
		const devUser = getDevUser();
		if (devUser) headers["X-User-Id"] = devUser.id;
	}
	return headers;
}

/** 手札や座席に使う、この人の id（ログインしていなければ開発ユーザー、それも無ければ "local"）。 */
export function localUserId(w: HostWiring): string {
	return w.user().id ?? getDevUser()?.id ?? "local";
}

/** 表示名（ログインしていなければ開発ユーザー）。 */
export function localUserName(w: HostWiring): string | undefined {
	return w.user().name ?? getDevUser()?.name;
}
