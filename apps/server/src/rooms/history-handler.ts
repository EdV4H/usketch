/**
 * BoardRoom の履歴 API。認可は手前のプロキシ（server-boards）で済ませ、`userId` はプロキシが
 * サーバー側で付ける（クライアントの値は使わない）。
 *
 * - GET  /history?limit=&cursor=         コミット一覧（新しい順）
 * - POST /history/commits                手動コミット { message?, trigger?: "manual" | "restore" }
 * - GET  /history/commits/:hash?page=    コミット時点のシェイプ全体
 * - GET  /history/diff?from=&to=&page=   差分（to 省略で現在のボードと比較）
 *
 * `page` はページを使うボードでどのページを見るか（省略時は先頭ページ）。
 */
import { isValidDocId } from "@edv4h/usketch-sync";
import type { HistoryManager } from "./history-manager.js";

const MAX_MESSAGE_LENGTH = 500;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

async function readCommitBody(
	request: Request,
): Promise<{ message: string; trigger: "manual" | "restore" } | null> {
	let raw: unknown = {};
	const text = await request.text();
	if (text.trim() !== "") {
		try {
			raw = JSON.parse(text);
		} catch {
			return null;
		}
	}
	if (typeof raw !== "object" || raw === null) return null;
	const { message, trigger } = raw as { message?: unknown; trigger?: unknown };
	if (message !== undefined && typeof message !== "string") return null;
	if (trigger !== undefined && trigger !== "manual" && trigger !== "restore") return null;
	return {
		message: (message ?? "").trim().slice(0, MAX_MESSAGE_LENGTH),
		trigger: trigger ?? "manual",
	};
}

/** `?page=`。doc id として使えない値は無視する。 */
function readPage(url: URL): string | null {
	const page = url.searchParams.get("page");
	return page && isValidDocId(page) ? page : null;
}

/** `/history` 以下ならレスポンスを、それ以外は null を返す。 */
export async function handleHistoryRequest(
	request: Request,
	url: URL,
	history: HistoryManager,
): Promise<Response | null> {
	const path = url.pathname;
	if (path !== "/history" && !path.startsWith("/history/")) return null;

	try {
		if (path === "/history" && request.method === "GET") {
			const limitParam = url.searchParams.get("limit");
			const limit = limitParam === null ? undefined : Number(limitParam);
			if (limit !== undefined && !Number.isFinite(limit)) {
				return json({ error: "Invalid limit" }, 400);
			}
			return json(await history.listCommits({ limit, cursor: url.searchParams.get("cursor") }));
		}

		if (path === "/history/commits" && request.method === "POST") {
			const body = await readCommitBody(request);
			if (!body) return json({ error: "Invalid body" }, 400);
			const userId = url.searchParams.get("userId");
			const commit = await history.recordCommit({
				trigger: body.trigger,
				message: body.message,
				author: userId && userId !== "anonymous" ? userId : null,
				allowEmpty: true,
			});
			return json({ commit }, 201);
		}

		if (path.startsWith("/history/commits/") && request.method === "GET") {
			const hash = path.slice("/history/commits/".length);
			const detail = await history.getCommit(hash, readPage(url));
			return detail ? json(detail) : json({ error: "Commit not found" }, 404);
		}

		if (path === "/history/diff" && request.method === "GET") {
			const from = url.searchParams.get("from");
			if (!from) return json({ error: "from is required" }, 400);
			const result = await history.diff(
				from,
				url.searchParams.get("to") ?? undefined,
				readPage(url),
			);
			return result ? json(result) : json({ error: "Commit not found" }, 404);
		}

		return json({ error: "Not found" }, 404);
	} catch (err) {
		console.error("[BoardRoom] history request failed:", err);
		return json({ error: "History request failed" }, 500);
	}
}
