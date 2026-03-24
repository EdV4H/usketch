/**
 * キャンバス操作ツール
 * canvas_clear, canvas_snapshot
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionManager } from "../client/connection-manager.js";

export function registerCanvasTools(server: McpServer, connections: ConnectionManager): void {
	server.tool(
		"canvas_clear",
		"ボード上の全シェイプを削除する",
		{ boardId: z.string().describe("ボードID") },
		async ({ boardId }) => {
			const conn = await connections.getConnection(boardId);
			const shapesMap = conn.getShapesMap();
			const count = shapesMap.size;

			conn.doc.transact(() => {
				for (const key of Array.from(shapesMap.keys())) {
					shapesMap.delete(key);
				}
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ cleared: count }),
					},
				],
			};
		},
	);

	server.tool(
		"canvas_snapshot",
		"現在のキャンバス状態をJSON形式で出力する（全シェイプの詳細情報を含む）",
		{ boardId: z.string().describe("ボードID") },
		async ({ boardId }) => {
			const conn = await connections.getConnection(boardId);
			const shapes = conn.getAllShapes();

			const snapshot = {
				boardId,
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
		},
	);
}
