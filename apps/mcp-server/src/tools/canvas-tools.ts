/**
 * キャンバス操作ツール
 * canvas_clear, canvas_snapshot, page_list
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connection-manager.js";
import { pageIdSchema, withShapes } from "./page-target.js";

export function registerCanvasTools(server: McpServer, connections: ConnectionManager): void {
	server.tool(
		"canvas_clear",
		"ボード上の全シェイプを削除する（ページを使うボードは 1 ページ分）",
		{ boardId: z.string().describe("ボードID"), pageId: pageIdSchema },
		async ({ boardId, pageId }) =>
			withShapes(connections, boardId, pageId, (_conn, view) => {
				const count = view.map.size;

				view.doc.transact(() => {
					for (const key of Array.from(view.map.keys())) {
						view.map.delete(key);
					}
				});

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ pageId: view.pageId, cleared: count }),
						},
					],
				};
			}),
	);

	server.tool(
		"canvas_snapshot",
		"現在のキャンバス状態をJSON形式で出力する（全シェイプの詳細情報を含む。ページを使うボードは 1 ページ分）",
		{ boardId: z.string().describe("ボードID"), pageId: pageIdSchema },
		async ({ boardId, pageId }) =>
			withShapes(connections, boardId, pageId, (_conn, view) => {
				const shapes = view.all();

				const snapshot = {
					boardId,
					pageId: view.pageId,
					shapeCount: shapes.length,
					shapes,
				};

				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify(snapshot, null, 2),
						},
					],
				};
			}),
	);

	server.tool(
		"page_list",
		"ボードのページ一覧を並び順で取得する。paged=false のボードはページを使わない（pageId は指定しない）",
		{ boardId: z.string().describe("ボードID") },
		async ({ boardId }) => {
			const conn = await connections.getConnection(boardId);
			const pages = conn.listPages().map(({ id, name, order }) => ({ id, name, order }));
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ boardId, paged: conn.isPaged, pages }, null, 2),
					},
				],
			};
		},
	);
}
