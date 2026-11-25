/**
 * DO への HTTP の呼び出し（履歴・サムネイル・AI の書き込み）で、呼んだ人がそのページを
 * 見られるか・書けるかを確かめる。
 *
 * Worker は `?boardId=` と `?userId=`（ログインしていなければ付けない）を付けて呼ぶ。役割は
 * クライアントの値を使わないよう、DO が D1 から読み直す（WebSocket と同じルールで判定する）。
 */
import type { DemoPageAccess } from "@edv4h/usketch-demo-permissions";
import type { BoardViewer } from "../page-access/queries.js";
import { PageNotFoundError } from "./board-shapes.js";
import { type AccessJudge, judgeAccess } from "./room-access.js";

export interface HttpAccessDeps {
	/** ボードでの役割と公開ボードか（見られなければ null）。 */
	loadViewer(boardId: string, userId: string | null): Promise<BoardViewer | null>;
	/** ボードのページの公開範囲（読めなければ null）。 */
	loadPageAccess(boardId: string): Promise<Map<string, DemoPageAccess> | null>;
	/** 使うページ（{@link import("./board-shapes.js").BoardShapes.resolve}）。 */
	resolvePage(pageId: string | null): Promise<string | null>;
}

export interface HttpAccess {
	judge: AccessJudge;
	pages: Map<string, DemoPageAccess>;
}

function json(body: unknown, status: number): Response {
	return Response.json(body, { status });
}

/** 呼んだ人の判定。ボードを見られなければ 404 などの Response。 */
export async function authorizeHttp(
	url: URL,
	fallbackBoardId: string,
	deps: HttpAccessDeps,
): Promise<HttpAccess | Response> {
	const boardId = url.searchParams.get("boardId") || fallbackBoardId;
	if (!boardId) return json({ error: "Board id required" }, 400);
	const raw = url.searchParams.get("userId");
	const userId = raw && raw !== "anonymous" ? raw : null;
	const viewer = await deps.loadViewer(boardId, userId);
	if (!viewer) return json({ error: "Board not found" }, 404);
	const pages = await deps.loadPageAccess(boardId);
	if (!pages) return json({ error: "Internal error" }, 500);
	return {
		judge: judgeAccess({
			userId,
			boardId,
			boardRole: viewer.boardRole,
			boardPublic: viewer.boardPublic,
		}),
		pages,
	};
}

/**
 * 呼んだ人がページ（null ならページを使うボードの先頭ページ）を見られる（`need: "view"`）・
 * 書ける（`"edit"`）か。よければ null、だめなら Response（見られなければ 404、見られるが
 * 書けなければ 403）。
 */
export async function authorizeHttpPage(
	url: URL,
	fallbackBoardId: string,
	pageId: string | null,
	need: "view" | "edit",
	deps: HttpAccessDeps,
): Promise<Response | null> {
	const auth = await authorizeHttp(url, fallbackBoardId, deps);
	if (auth instanceof Response) return auth;
	let target: string | null;
	try {
		target = await deps.resolvePage(pageId);
	} catch (e) {
		if (e instanceof PageNotFoundError) return json({ error: "Page not found" }, 404);
		throw e;
	}
	const page = target === null ? undefined : auth.pages.get(target);
	if (!auth.judge.canView(target, page)) return json({ error: "Page not found" }, 404);
	if (need === "edit" && !auth.judge.canEdit(target, page)) {
		return json({ error: "Forbidden" }, 403);
	}
	return null;
}
