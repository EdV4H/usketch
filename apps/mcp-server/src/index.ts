#!/usr/bin/env node
/**
 * uSketch MCP サーバー エントリポイント
 *
 * 使い方:
 *   node dist/index.js           → stdio トランスポート（Claude Code 用）
 *   node dist/index.js --http    → SSE/HTTP トランスポート
 *   node dist/index.js --http --port 3100
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createMcpServer } from "./mcp-server.js";

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const isHttp = args.includes("--http");
	const portIndex = args.indexOf("--port");
	const _port = portIndex >= 0 ? Number(args[portIndex + 1]) : 3100;

	const config = loadConfig();
	const { server, connections } = createMcpServer(config);

	if (isHttp) {
		// SSE/HTTP トランスポート（Phase 3 拡張）
		const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
		const { createServer } = await import("node:http");

		let sseTransport: InstanceType<typeof SSEServerTransport> | null = null;

		const httpServer = createServer(async (req, res) => {
			const url = new URL(req.url ?? "/", `http://localhost:${_port}`);

			if (url.pathname === "/sse") {
				sseTransport = new SSEServerTransport("/messages", res);
				await server.connect(sseTransport);
				return;
			}

			if (url.pathname === "/messages" && req.method === "POST") {
				if (!sseTransport) {
					res.writeHead(400);
					res.end("No SSE connection");
					return;
				}
				await sseTransport.handlePostMessage(req, res);
				return;
			}

			// Health check
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok", name: "usketch-mcp-server" }));
		});

		httpServer.listen(_port, () => {
			console.error(`uSketch MCP server (SSE) listening on port ${_port}`);
		});
	} else {
		// stdio トランスポート（デフォルト）
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error("uSketch MCP server started (stdio)");
	}

	// Graceful shutdown
	const cleanup = () => {
		connections.destroyAll();
		process.exit(0);
	};
	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
}

main().catch((err) => {
	console.error("Failed to start MCP server:", err);
	process.exit(1);
});
