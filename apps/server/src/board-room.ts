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

const DEFAULT_STYLE = {
	fill: "#ffffff",
	stroke: "#1e1e1e",
	strokeWidth: 2,
	opacity: 1,
};

/** 簡易ID生成（サーバー側用） */
function generateShapeId(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let id = "";
	for (let i = 0; i < 12; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

interface AiShapeInput {
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	text?: string;
	fontSize?: number;
	style?: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
	};
}

// yjs を動的importするためのキャッシュ
let yjsModule: typeof import("yjs") | null = null;
async function getYjs(): Promise<typeof import("yjs")> {
	if (!yjsModule) {
		yjsModule = await import("yjs");
	}
	return yjsModule;
}

/**
 * BoardRoom Durable Object
 * ボードごとに1インスタンス。WebSocket接続を管理し、Yjs updateを中継する。
 */
export class BoardRoom extends DurableObject<Env> {
	/** 蓄積されたYjs更新のバッファ（新規接続時の初期同期用） */
	private updates: Uint8Array[] = [];
	/** このDurable Objectに対応するボードID */
	private boardId = "";
	/** AI操作用のY.Doc（遅延初期化、動的importで構築） */
	private doc: unknown | null = null;

	/** 蓄積されたupdatesからY.Docを構築/取得 */
	private async getOrCreateDoc(): Promise<{ doc: import("yjs").Doc }> {
		const Y = await getYjs();
		if (!this.doc) {
			this.doc = new Y.Doc();
			// 蓄積されたupdatesをすべて適用して現在状態を復元
			for (const update of this.updates) {
				Y.applyUpdate(this.doc as import("yjs").Doc, update);
			}
		}
		return { doc: this.doc as import("yjs").Doc };
	}

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

		// AI シェイプ配置エンドポイント
		if (url.pathname === "/ai-place-shapes" && request.method === "POST") {
			return this.handleAiPlaceShapes(request);
		}

		return new Response("BoardRoom OK", { status: 200 });
	}

	/** AIシェイプ配置: Y.Docに書き込み → Yjs updateを全クライアントにbroadcast */
	private async handleAiPlaceShapes(request: Request): Promise<Response> {
		try {
			const body = (await request.json()) as { shapes: AiShapeInput[] };
			const shapes = body.shapes;
			if (!shapes || !Array.isArray(shapes) || shapes.length === 0) {
				return new Response(JSON.stringify({ error: "No shapes provided" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const { doc } = await this.getOrCreateDoc();
			const shapesMap = doc.getMap<Record<string, unknown>>("shapes");
			const placedShapes: Array<{
				id: string;
				type: string;
				x: number;
				y: number;
				width: number;
				height: number;
			}> = [];

			// updateイベントをキャプチャしてbroadcastする
			const pendingUpdates: Uint8Array[] = [];
			const onUpdate = (update: Uint8Array) => {
				pendingUpdates.push(update);
			};
			doc.on("update", onUpdate);

			try {
				// トランザクション内で全シェイプを一括書き込み
				// クライアントの同期プラグインはプレーンオブジェクトを期待するため
				// Y.Mapではなくプレーンオブジェクトとして書き込む
				doc.transact(() => {
					for (const shape of shapes) {
						const id = generateShapeId();
						// textシェイプはデフォルトでfill:transparent, strokeWidth:0
						const baseStyle =
							shape.type === "text"
								? { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 }
								: DEFAULT_STYLE;
						const style = { ...baseStyle, ...shape.style };

						const shapeData: Record<string, unknown> = {
							id,
							type: shape.type,
							x: shape.x,
							y: shape.y,
							width: shape.width,
							height: shape.height,
							style,
						};

						// テキスト固有フィールド
						if (shape.text !== undefined) {
							shapeData.text = shape.text;
						}
						if (shape.type === "text") {
							shapeData.fontSize = shape.fontSize ?? 16;
							shapeData.fontFamily = "system-ui, sans-serif";
							shapeData.isEditing = false;
						}

						shapesMap.set(id, shapeData);

						placedShapes.push({
							id,
							type: shape.type,
							x: shape.x,
							y: shape.y,
							width: shape.width,
							height: shape.height,
						});
					}
				});
			} finally {
				doc.off("update", onUpdate);
			}

			// 生成されたupdatesをbroadcast + バッファに追加
			for (const update of pendingUpdates) {
				this.updates.push(update);
				// MSG_YJS_UPDATE としてフレーミング
				const msg = new Uint8Array(update.length + 1);
				msg[0] = MSG_YJS_UPDATE;
				msg.set(update, 1);
				this.broadcastAll(msg);
			}

			// バッファサイズ制限
			if (this.updates.length > MAX_UPDATES_BUFFER) {
				this.updates = this.updates.slice(-MAX_UPDATES_BUFFER);
			}

			return new Response(JSON.stringify({ placedShapes }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			return new Response(
				JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
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
				// Y.Docが構築済みならupdateを適用（動的importを使うため非同期）
				if (this.doc) {
					const Y = await getYjs();
					Y.applyUpdate(this.doc as import("yjs").Doc, payload);
				}
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
		try {
			ws.close(code);
		} catch {
			// 既に閉じているソケットは無視
		}
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

	/** 全接続にメッセージを送信（AI操作など、送信元がWebSocketではない場合） */
	private broadcastAll(data: Uint8Array): void {
		for (const ws of this.ctx.getWebSockets()) {
			try {
				ws.send(data);
			} catch {
				// 切断済みソケットは無視
			}
		}
	}
}
