/**
 * MCP リソース定義
 * usketch://boards, usketch://boards/{boardId}/shapes
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConnectionManager } from "../client/connection-manager.js";
import type { UsketchClient } from "../client/usketch-client.js";

export function registerBoardResources(
	server: McpServer,
	client: UsketchClient,
	connections: ConnectionManager,
): void {
	server.resource(
		"boards-list",
		"usketch://boards",
		{ description: "アクセス可能なボード一覧", mimeType: "application/json" },
		async () => {
			const boards = await client.listBoards();
			return {
				contents: [
					{
						uri: "usketch://boards",
						mimeType: "application/json",
						text: JSON.stringify(boards, null, 2),
					},
				],
			};
		},
	);

	const shapesTemplate = new ResourceTemplate("usketch://boards/{boardId}/shapes", {
		list: undefined,
	});

	server.resource(
		"board-shapes",
		shapesTemplate,
		{ description: "ボード上の全シェイプ", mimeType: "application/json" },
		async (uri, variables) => {
			const boardId = variables.boardId as string;
			const conn = await connections.getConnection(boardId);
			const shapes = conn.getAllShapes();
			return {
				contents: [
					{
						uri: uri.href,
						mimeType: "application/json",
						text: JSON.stringify(shapes, null, 2),
					},
				],
			};
		},
	);
}
