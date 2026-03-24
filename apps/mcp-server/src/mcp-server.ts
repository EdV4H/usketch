/**
 * MCP サーバー定義
 * ツールとリソースを登録して返す
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ConnectionManager } from "./client/connection-manager.js";
import { UsketchClient } from "./client/usketch-client.js";
import type { McpConfig } from "./config.js";
import { registerBoardResources } from "./resources/board-resource.js";
import { registerBoardTools } from "./tools/board-tools.js";
import { registerCanvasTools } from "./tools/canvas-tools.js";
import { registerShapeTools } from "./tools/shape-tools.js";

export interface McpServerContext {
	server: McpServer;
	client: UsketchClient;
	connections: ConnectionManager;
}

export function createMcpServer(config: McpConfig): McpServerContext {
	const server = new McpServer({
		name: "usketch",
		version: "0.0.0",
	});

	const client = new UsketchClient(config);
	const connections = new ConnectionManager(config);

	// ツール登録
	registerBoardTools(server, client);
	registerShapeTools(server, connections);
	registerCanvasTools(server, connections);

	// リソース登録
	registerBoardResources(server, client, connections);

	return { server, client, connections };
}
