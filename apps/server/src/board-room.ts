import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types.js";

/**
 * BoardRoom Durable Object
 * Week 5-6 で Yjs WebSocket 同期を実装する。
 * 現時点では最小限のスタブ。
 */
export class BoardRoom extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			// WebSocket upgrade
			if (request.headers.get("Upgrade") !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const pair = new WebSocketPair();
			this.ctx.acceptWebSocket(pair[1]);

			return new Response(null, { status: 101, webSocket: pair[0] });
		}

		return new Response("BoardRoom OK", { status: 200 });
	}

	async webSocketMessage(_ws: WebSocket, _message: ArrayBuffer | string): Promise<void> {
		// TODO: Yjs update message relay
		// Week 5-6 で実装
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		ws.close(code);
	}
}
