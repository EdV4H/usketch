/**
 * ツールが読み書きするページの指定（ページを使うボード用）。
 */

import { z } from "zod";
import {
	type BoardConnection,
	PageNotFoundError,
	type ShapesView,
} from "../client/board-connection.js";
import type { ConnectionManager } from "../client/connection-manager.js";

/** ツールの `pageId` 引数。 */
export const pageIdSchema = z
	.string()
	.optional()
	.describe("ページID（ページを使うボードのみ。省略時は先頭ページ。一覧は page_list）");

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

/**
 * ボードにつないで `pageId` のシェイプを開き、`run` を呼ぶ。
 * 無いページはツールのエラーとして返す。
 */
export async function withShapes(
	connections: ConnectionManager,
	boardId: string,
	pageId: string | undefined,
	run: (conn: BoardConnection, shapes: ShapesView) => ToolResult | Promise<ToolResult>,
): Promise<ToolResult> {
	const conn = await connections.getConnection(boardId);
	let shapes: ShapesView;
	try {
		shapes = await conn.openShapes(pageId);
	} catch (e) {
		if (!(e instanceof PageNotFoundError)) throw e;
		const message = conn.isPaged
			? `Page not found: ${e.pageId}（page_list でページを確認してください）`
			: `This board has no pages; omit pageId (got: ${e.pageId})`;
		return { content: [{ type: "text", text: message }], isError: true };
	}
	return run(conn, shapes);
}
