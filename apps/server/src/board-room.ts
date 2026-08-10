import { DurableObject } from "cloudflare:workers";
import type { ClientToServer, ServerToClient } from "@edv4h/usketch-session-protocol";
import {
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_PARTITION_REQUEST,
	MSG_SESSION,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { boardMembers } from "./db/schema.js";
import { handleAiPlaceShapes, handleAiUpdateShapes } from "./rooms/ai-handler.js";
import { createPartitionManager } from "./rooms/partition-manager.js";
import { SessionManager, type SessionSnapshot } from "./rooms/session-manager.js";
import { createSnapshotManager } from "./rooms/snapshot-manager.js";
import { handleThumbnail } from "./rooms/thumbnail-handler.js";
import { createYjsSync } from "./rooms/yjs-sync.js";
import type { Env } from "./types.js";

/** Reconnect grace window for live sessions (ms). */
const SESSION_GRACE_MS = 45_000;

/**
 * BoardRoom Durable Object
 * ボードごとに1インスタンス。WebSocket接続を管理し、Yjs updateを中継する。
 */
export class BoardRoom extends DurableObject<Env> {
	private boardId = "";

	private readonly yjsSync = createYjsSync({ storage: this.ctx.storage });
	private readonly partitions = createPartitionManager({ storage: this.ctx.storage });
	private readonly snapshots = createSnapshotManager({
		storage: this.ctx.storage,
		getOrCreateDoc: () => this.yjsSync.getOrCreateDoc(),
		getWebSockets: () => this.ctx.getWebSockets(),
	});

	// Server-authoritative live sessions (voting / tutorial / card game). State is
	// persisted to DO storage and the reconnect grace uses the DO alarm.
	private sessionsLoaded = false;
	private readonly sessions = new SessionManager({
		send: (userId, msg) => this.sessionSend(userId, msg),
		broadcast: (msg) => this.broadcastAll(this.sessionFrame(msg)),
		now: () => Date.now(),
		genId: () => crypto.randomUUID(),
		persist: (snap) => {
			void this.ctx.storage.put("sessions", snap);
		},
		setAlarm: (at) => {
			if (at == null) void this.ctx.storage.deleteAlarm();
			else void this.ctx.storage.setAlarm(at);
		},
		graceMs: SESSION_GRACE_MS,
	});

	private sessionFrame(msg: ServerToClient): Uint8Array {
		const encoded = new TextEncoder().encode(JSON.stringify(msg));
		const buf = new Uint8Array(encoded.length + 1);
		buf[0] = MSG_SESSION;
		buf.set(encoded, 1);
		return buf;
	}

	/** Send a session message to every socket belonging to one user (targeted). */
	private sessionSend(userId: string, msg: ServerToClient): void {
		const frame = this.sessionFrame(msg);
		for (const ws of this.ctx.getWebSockets()) {
			if (this.ctx.getTags(ws)[0] === userId) {
				try {
					ws.send(frame);
				} catch {
					// 閉じたソケットは無視
				}
			}
		}
	}

	private async loadSessions(): Promise<void> {
		if (this.sessionsLoaded) return;
		this.sessionsLoaded = true;
		const snap = (await this.ctx.storage.get("sessions")) as SessionSnapshot | undefined;
		this.sessions.restore(snap);
	}

	/** DO alarm: drive session reconnect-grace expiry. */
	async alarm(): Promise<void> {
		await this.loadSessions();
		this.sessions.onAlarm();
	}

	async fetch(request: Request): Promise<Response> {
		await this.yjsSync.loadUpdates();
		await this.partitions.loadFromStorage();
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			return this.handleWebSocketUpgrade(request, url);
		}

		if (url.pathname === "/ai-place-shapes" && request.method === "POST") {
			return handleAiPlaceShapes(request, {
				getOrCreateDoc: () => this.yjsSync.getOrCreateDoc(),
				pushUpdate: (u) => this.yjsSync.pushUpdate(u),
				broadcastAll: (d) => this.broadcastAll(d),
				scheduleSave: () => this.yjsSync.scheduleSave(),
			});
		}

		if (url.pathname === "/ai-update-shapes" && request.method === "POST") {
			return handleAiUpdateShapes(request, {
				getOrCreateDoc: () => this.yjsSync.getOrCreateDoc(),
				pushUpdate: (u) => this.yjsSync.pushUpdate(u),
				broadcastAll: (d) => this.broadcastAll(d),
				scheduleSave: () => this.yjsSync.scheduleSave(),
			});
		}

		if (url.pathname === "/thumbnail") {
			return handleThumbnail(url, () => this.yjsSync.getOrCreateDoc());
		}

		if (url.pathname === "/snapshots" && request.method === "GET") {
			return this.snapshots.handleListSnapshots();
		}
		if (url.pathname === "/snapshot" && request.method === "POST") {
			return this.snapshots.handleCreateSnapshot();
		}
		if (url.pathname.startsWith("/snapshots/") && request.method === "GET") {
			const ts = url.pathname.split("/snapshots/")[1];
			return this.snapshots.handleGetSnapshot(ts);
		}

		return new Response("BoardRoom OK", { status: 200 });
	}

	private async handleWebSocketUpgrade(request: Request, url: URL): Promise<Response> {
		const bid = url.searchParams.get("boardId");
		if (bid) this.boardId = bid;
		if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
			return new Response("Expected WebSocket", { status: 426 });
		}

		const userId = url.searchParams.get("userId") ?? "anonymous";
		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1], [userId, this.boardId]);

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

		this.snapshots.scheduleAutoSnapshot();
		return new Response(null, { status: 101, webSocket: pair[0] });
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
		if (typeof message === "string") return;

		const data = new Uint8Array(message);
		if (data.length === 0) return;

		const msgType = data[0];
		const payload = data.slice(1);

		switch (msgType) {
			case MSG_YJS_UPDATE: {
				const applied = await this.yjsSync.applyClientUpdate(payload);
				if (!applied) {
					break;
				}
				this.yjsSync.pushUpdate(payload);
				this.partitions.trackUpdate(payload);
				this.broadcast(ws, data);
				this.yjsSync.scheduleSave();
				break;
			}
			case MSG_AWARENESS:
			case MSG_BROADCAST: {
				this.broadcast(ws, data);
				break;
			}
			case MSG_SESSION: {
				await this.loadSessions();
				const userId = this.ctx.getTags(ws)[0] ?? "anonymous";
				if (userId === "anonymous") break; // 未認証はセッション不可
				try {
					const msg = JSON.parse(new TextDecoder().decode(payload)) as ClientToServer;
					this.sessions.handle(userId, msg);
				} catch {
					// 不正なメッセージは無視
				}
				break;
			}
			case MSG_SYNC_STEP1: {
				for (const update of this.yjsSync.getUpdates()) {
					const msg = new Uint8Array(update.length + 1);
					msg[0] = MSG_SYNC_STEP2;
					msg.set(update, 1);
					ws.send(msg);
				}
				this.partitions.sendPartitionMeta(ws);
				break;
			}
			case MSG_PARTITION_REQUEST: {
				try {
					const request = JSON.parse(new TextDecoder().decode(payload)) as {
						partitions: string[];
					};
					for (const name of request.partitions) {
						const updates = this.partitions.getPartitionUpdates(name);
						if (updates) {
							for (const update of updates) {
								const msg = new Uint8Array(update.length + 1);
								msg[0] = MSG_SYNC_STEP2;
								msg.set(update, 1);
								ws.send(msg);
							}
						}
					}
				} catch {
					// 不正なリクエストは無視
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
		const tags = this.ctx.getTags(ws);
		const userId = tags[0];
		const boardId = tags[1];
		if (userId && userId !== "anonymous" && boardId) {
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
				// このユーザーの最後の接続 → セッションの離脱猶予を開始（DO alarm）。
				await this.loadSessions();
				this.sessions.onDisconnect(userId);
			}
		}
		try {
			ws.close(code);
		} catch {
			// 既に閉じているソケットは無視
		}

		if (this.ctx.getWebSockets().length === 0) {
			this.yjsSync.destroyDoc();
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

	/** 全接続にメッセージを送信 */
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
