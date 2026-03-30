import { DurableObject } from "cloudflare:workers";
import { computeMinimap, minimapToSvg, type ShapeData } from "@edv4h/usketch-shared";
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

/** ID生成（サーバー側用、crypto.randomUUIDで衝突リスク排除） */
function generateShapeId(): string {
	return crypto.randomUUID();
}

interface AiShapeUpdate {
	id: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	text?: string;
	fontSize?: number;
	style?: {
		fill?: string;
		stroke?: string;
		strokeWidth?: number;
		opacity?: number;
	};
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
	/** storage から updates を読み込み済みか */
	private loaded = false;

	/** storage から updates を復元（初回のみ） */
	private async loadUpdates(): Promise<void> {
		if (this.loaded) return;
		this.loaded = true;
		const stored = await this.ctx.storage.get<string>("yjs_updates");
		if (stored) {
			try {
				const arr = JSON.parse(stored) as number[][];
				for (const a of arr) {
					this.updates.push(new Uint8Array(a));
				}
			} catch {
				// 破損データは無視
			}
		}
	}

	/** updates を storage に永続化 */
	private async saveUpdates(): Promise<void> {
		// 最新の MAX_UPDATES_BUFFER 件のみ保存
		const data = this.updates.slice(-MAX_UPDATES_BUFFER).map((u) => Array.from(u));
		await this.ctx.storage.put("yjs_updates", JSON.stringify(data));
	}

	/** 蓄積されたupdatesからY.Docを構築/取得 */
	private async getOrCreateDoc(): Promise<{ doc: import("yjs").Doc }> {
		await this.loadUpdates();
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
		await this.loadUpdates();
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

		// AI シェイプ更新エンドポイント（Smart Actions）
		if (url.pathname === "/ai-update-shapes" && request.method === "POST") {
			return this.handleAiUpdateShapes(request);
		}

		// サムネイル SVG エンドポイント
		if (url.pathname === "/thumbnail") {
			return this.handleThumbnail(url);
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

			await this.saveUpdates();
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

	/** AIシェイプ更新: 既存シェイプのプロパティを更新 → Yjs updateを全クライアントにbroadcast */
	private async handleAiUpdateShapes(request: Request): Promise<Response> {
		try {
			const body = (await request.json()) as { updates: AiShapeUpdate[] };
			const updates = body.updates;
			if (!updates || !Array.isArray(updates) || updates.length === 0) {
				return new Response(JSON.stringify({ error: "No updates provided" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const { doc } = await this.getOrCreateDoc();
			const shapesMap = doc.getMap<Record<string, unknown>>("shapes");
			const updatedShapes: Array<{
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
				doc.transact(() => {
					for (const update of updates) {
						const existing = shapesMap.get(update.id);
						if (!existing) continue;

						// 既存シェイプをコピーして更新フィールドを適用
						const updated: Record<string, unknown> = { ...existing };

						if (update.x !== undefined) updated.x = update.x;
						if (update.y !== undefined) updated.y = update.y;
						if (update.width !== undefined) updated.width = update.width;
						if (update.height !== undefined) updated.height = update.height;
						if (update.text !== undefined) updated.text = update.text;

						// テキストシェイプのfontSize更新（既存のfontFamily/isEditingは保持）
						if (update.fontSize !== undefined) {
							updated.fontSize = update.fontSize;
						}

						// スタイルはマージ（既存スタイルを保持しつつ更新フィールドを上書き）
						if (update.style !== undefined) {
							const existingStyle = (existing.style ?? {}) as Record<string, unknown>;
							updated.style = { ...existingStyle, ...update.style };
						}

						// プレーンオブジェクトとして書き戻し
						shapesMap.set(update.id, updated);

						updatedShapes.push({
							id: update.id,
							type: updated.type as string,
							x: updated.x as number,
							y: updated.y as number,
							width: updated.width as number,
							height: updated.height as number,
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

			await this.saveUpdates();
			return new Response(JSON.stringify({ updatedShapes }), {
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
		console.log(
			`[BoardRoom] webSocketMessage: type=${msgType}, len=${data.length}, board=${this.boardId}`,
		);
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
				// updates を永続化（非同期、エラーは無視）
				this.saveUpdates().catch(() => {});
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

	/** サムネイル SVG を生成して返す */
	private async handleThumbnail(url: URL): Promise<Response> {
		try {
			const width = Number(url.searchParams.get("w")) || 240;
			const height = Number(url.searchParams.get("h")) || 160;

			const { doc } = await this.getOrCreateDoc();
			const shapesMap = doc.getMap<Record<string, unknown>>("shapes");

			const shapes: ShapeData[] = [];
			for (const [, value] of shapesMap) {
				const s = value as Record<string, unknown>;
				if (
					typeof s.id === "string" &&
					typeof s.x === "number" &&
					typeof s.y === "number" &&
					typeof s.width === "number" &&
					typeof s.height === "number"
				) {
					shapes.push({
						id: s.id,
						type: (s.type as string) ?? "unknown",
						x: s.x,
						y: s.y,
						width: s.width,
						height: s.height,
						style: {
							fill: ((s.style as Record<string, unknown>)?.fill as string) ?? "#ffffff",
							stroke: ((s.style as Record<string, unknown>)?.stroke as string) ?? "#1e1e1e",
							strokeWidth: ((s.style as Record<string, unknown>)?.strokeWidth as number) ?? 2,
							opacity: ((s.style as Record<string, unknown>)?.opacity as number) ?? 1,
						},
					});
				}
			}

			const result = computeMinimap({
				shapes,
				mapWidth: width,
				mapHeight: height,
				padding: 20,
				minSize: 2,
			});

			const svg = minimapToSvg(result, width, height, {
				background: "#f8f9fa",
				strokeColor: "#e2e8f0",
			});

			return new Response(svg, {
				status: 200,
				headers: {
					"Content-Type": "image/svg+xml",
					"Cache-Control": "public, max-age=30",
				},
			});
		} catch {
			return new Response(
				`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#f8f9fa" rx="4"/></svg>`,
				{
					status: 200,
					headers: { "Content-Type": "image/svg+xml" },
				},
			);
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
