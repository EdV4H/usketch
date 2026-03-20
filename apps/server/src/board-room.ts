import { DurableObject } from "cloudflare:workers";
import {
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { boardMembers } from "./db/schema.js";
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
	/** このDurable Objectに対応するボードID */
	private boardId = "";

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			// boardIdをクエリパラメータから取得（接続時に1度だけ設定）
			const bid = url.searchParams.get("boardId");
			if (bid) this.boardId = bid;
			if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const userId = url.searchParams.get("userId") ?? "anonymous";
			const pair = new WebSocketPair();
			this.ctx.acceptWebSocket(pair[1], [userId, this.boardId]);

			// 接続時にステータスをonlineに更新
			if (userId !== "anonymous" && this.boardId) {
				try {
					const db = drizzle(this.env.DB);
					await db
						.update(boardMembers)
						.set({ status: "online", lastSeenAt: new Date().toISOString() })
						.where(and(eq(boardMembers.boardId, this.boardId), eq(boardMembers.userId, userId)));
				} catch {
					// DB更新失敗は接続をブロックしない
				}
			}

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
		// 切断時にメンバーのステータスとlast_seen_atを更新
		const tags = this.ctx.getTags(ws);
		const userId = tags[0];
		const boardId = tags[1];
		if (userId && userId !== "anonymous" && boardId) {
			// 同じユーザー+ボードで他のWebSocket接続が残っていないか確認
			let hasOtherConnection = false;
			for (const otherWs of this.ctx.getWebSockets()) {
				if (otherWs === ws) continue;
				const otherTags = this.ctx.getTags(otherWs);
				if (otherTags[0] === userId && otherTags[1] === boardId) {
					hasOtherConnection = true;
					break;
				}
			}

			if (!hasOtherConnection) {
				try {
					const db = drizzle(this.env.DB);
					const now = new Date().toISOString();
					await db
						.update(boardMembers)
						.set({ status: "offline", lastSeenAt: now })
						.where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
				} catch {
					// DB更新失敗はWebSocket切断をブロックしない
				}
			}
		}
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
