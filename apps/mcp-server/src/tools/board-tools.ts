/**
 * ボード管理ツール
 * board_list, board_create, board_get, board_delete
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { UsketchClient } from "../client/usketch-client.js";

export function registerBoardTools(server: McpServer, client: UsketchClient): void {
	server.tool("board_list", "アクセス可能なボード一覧を取得", {}, async () => {
		const boards = await client.listBoards();
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(boards, null, 2),
				},
			],
		};
	});

	server.tool(
		"board_create",
		"新しいボードを作成",
		{ title: z.string().optional().describe("ボードタイトル（省略時: Untitled）") },
		async ({ title }) => {
			const result = await client.createBoard(title);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"board_get",
		"ボードの詳細情報を取得",
		{ boardId: z.string().describe("ボードID") },
		async ({ boardId }) => {
			const board = await client.getBoard(boardId);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(board, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"board_delete",
		"ボードを削除",
		{ boardId: z.string().describe("ボードID") },
		async ({ boardId }) => {
			const result = await client.deleteBoard(boardId);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);

	server.tool(
		"board_update",
		"ボードのタイトルや公開設定を更新",
		{
			boardId: z.string().describe("ボードID"),
			title: z.string().optional().describe("新しいタイトル"),
			isPublic: z.boolean().optional().describe("公開設定 (true=公開, false=非公開)"),
		},
		async ({ boardId, title, isPublic }) => {
			const data: { title?: string; isPublic?: boolean } = {};
			if (title !== undefined) data.title = title;
			if (isPublic !== undefined) data.isPublic = isPublic;
			const result = await client.updateBoard(boardId, data);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		},
	);
}
