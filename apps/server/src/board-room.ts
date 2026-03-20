import { DurableObject } from "cloudflare:workers";
import {
	MSG_AWARENESS,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_TRANSIENT,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import type { Env } from "./types.js";

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

			// 新規接続に蓄積された更新を送信
			for (const update of this.updates) {
				const msg = new Uint8Array(update.length + 1);
				msg[0] = MSG_YJS_UPDATE;
				msg.set(update, 1);
				pair[1].send(msg);
			}

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
				// 更新をバッファに蓄積（新規接続の初期同期用）
				this.updates.push(payload);
				// 他の全クライアントに中継
				this.broadcast(ws, data);
				break;
			}
			case MSG_AWARENESS:
			case MSG_TRANSIENT: {
				// Awareness/Transientは蓄積不要、リアルタイムで中継のみ
				this.broadcast(ws, data);
				break;
			}
			case MSG_SYNC_STEP1: {
				// クライアントからの同期リクエスト — 蓄積された全更新を返送
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
