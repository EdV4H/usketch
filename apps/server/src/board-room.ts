import { DurableObject } from "cloudflare:workers";
import {
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import type { Env } from "./types.js";

/** バッファの最大件数。超えたら古い更新から間引く */
const MAX_UPDATES_BUFFER = 500;

/**
 * BoardRoom Durable Object
 * ボードごとに1インスタンス。WebSocket接続を管理し、Yjs updateを中継する。
 */
export class BoardRoom extends DurableObject<Env> {
	/** 蓄積されたYjs更新のバッファ（新規接続時の初期同期用） */
	private updates: Uint8Array[] = [];

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const userId = url.searchParams.get("userId") ?? "anonymous";
			const pair = new WebSocketPair();
			this.ctx.acceptWebSocket(pair[1], [userId]);

			// 初期同期はクライアントのMSG_SYNC_STEP1リクエストで行う
			return new Response(null, { status: 101, webSocket: pair[0] });
		}

		return new Response("BoardRoom OK", { status: 200 });
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
		if (typeof message === "string") return;

		const data = new Uint8Array(message);
		if (data.length === 0) return;

		const msgType = data[0];
		const payload = data.slice(1);

		switch (msgType) {
			case MSG_YJS_UPDATE: {
				this.updates.push(payload);
				// バッファサイズ制限
				if (this.updates.length > MAX_UPDATES_BUFFER) {
					this.updates = this.updates.slice(-MAX_UPDATES_BUFFER);
				}
				this.broadcast(ws, data);
				break;
			}
			case MSG_AWARENESS:
			case MSG_BROADCAST: {
				this.broadcast(ws, data);
				break;
			}
			case MSG_SYNC_STEP1: {
				// クライアントからの初期同期リクエスト — 蓄積された全更新を返送
				for (const update of this.updates) {
					const msg = new Uint8Array(update.length + 1);
					msg[0] = MSG_SYNC_STEP2;
					msg.set(update, 1);
					ws.send(msg);
				}
				break;
			}
		}
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		_reason: string,
		_wasClean: boolean,
	): Promise<void> {
		ws.close(code);
	}

	/** 送信元以外の全接続にメッセージを中継 */
	private broadcast(sender: WebSocket, data: Uint8Array): void {
		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== sender) {
				try {
					ws.send(data);
				} catch {
					// 切断済みソケットは無視
				}
			}
		}
	}
}
