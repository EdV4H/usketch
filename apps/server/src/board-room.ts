import { DurableObject } from "cloudflare:workers";
import type { DemoPageAccess } from "@edv4h/usketch-demo-permissions";
import { gatherServerType } from "@edv4h/usketch-session-gather/server";
import type { ClientToServer, ServerToClient } from "@edv4h/usketch-session-protocol";
import { respondServerType } from "@edv4h/usketch-session-respond/server";
import { votingServerType } from "@edv4h/usketch-session-voting/server";
import type { ShapeData } from "@edv4h/usketch-shared";
import {
	decodeDocFrame,
	encodeDocFrame,
	getLegacyPageId,
	isPagedBoard,
	listPages,
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_DOC_DENIED,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_UNSUBSCRIBE,
	MSG_DOC_UPDATE,
	MSG_PARTITION_REQUEST,
	MSG_PERMISSIONS_CHANGED,
	MSG_SESSION,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { boardMembers } from "./db/schema.js";
import { loadPageAccess } from "./page-access/queries.js";
import { handleAiPlaceShapes, handleAiUpdateShapes } from "./rooms/ai-handler.js";
import { createBoardShapes, PageNotFoundError, type ShapesTarget } from "./rooms/board-shapes.js";
import { handleHistoryRequest } from "./rooms/history-handler.js";
import { createHistoryManager } from "./rooms/history-manager.js";
import { deleteLegacySnapshots } from "./rooms/legacy-snapshot-cleanup.js";
import { createPageDocs, subscribedDocIds } from "./rooms/page-docs.js";
import { createPagesMigration } from "./rooms/pages-migration.js";
import { createPartitionManager } from "./rooms/partition-manager.js";
import {
	canEditPage,
	canEditRoot,
	canViewPage,
	readAccessParams,
	setSocketAccess,
	socketBoardId,
} from "./rooms/room-access.js";
import { SessionManager, type SessionSnapshot } from "./rooms/session-manager.js";
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
	/** ページの公開範囲（D1 の `page_access`）。権限が変わったと知らされたら読み直す。 */
	private pageAccessCache: { boardId: string; map: Promise<Map<string, DemoPageAccess>> } | null =
		null;

	private readonly yjsSync = createYjsSync({ storage: this.ctx.storage });
	private readonly partitions = createPartitionManager({ storage: this.ctx.storage });
	/** 旧スナップショット（Time Travel）の保存データを消す処理を、このインスタンスで始めたか。 */
	private legacySnapshotsCleared = false;
	// Git 風のボード履歴（自動・手動コミット）。Yjs ドキュメントの shapes をスナップショットする。
	// ページを使うボードはページごとの tree にし、自動コミットは編集されたページだけを読む。
	private readonly history = createHistoryManager({
		storage: this.ctx.storage,
		getShapes: async (pageId) => {
			let target: ShapesTarget;
			try {
				target = await this.boardShapes.open(pageId);
			} catch (e) {
				// 削除済みのページなど、今は開けないページは空として比べる
				if (e instanceof PageNotFoundError) return {};
				throw e;
			}
			try {
				return target.doc.getMap<ShapeData>("shapes").toJSON() as Record<string, ShapeData>;
			} finally {
				target.release();
			}
		},
		getPageIds: async () => {
			const { doc } = await this.yjsSync.getOrCreateDoc();
			return isPagedBoard(doc) ? listPages(doc).map((p) => p.id) : null;
		},
		getLegacyPageId: async () => getLegacyPageId((await this.yjsSync.getOrCreateDoc()).doc),
	});

	/**
	 * 旧スナップショット API の保存データを裏で消す（インスタンスごとに 1 回、接続時）。
	 * 履歴は history-manager に一本化した。消し終わる前に止まっても次の接続でやり直す。
	 */
	private clearLegacySnapshots(): void {
		if (this.legacySnapshotsCleared) return;
		this.legacySnapshotsCleared = true;
		this.ctx.waitUntil(
			deleteLegacySnapshots(this.ctx.storage).catch((err) => {
				this.legacySnapshotsCleared = false;
				console.error("[BoardRoom] legacy snapshot cleanup failed:", err);
			}),
		);
	}

	// ページ doc（ルート doc とは別に同期する Y.Doc）。購読された doc だけを読み込む。
	// ページの編集は、そのページを履歴の次の自動コミットで読み直す印にする。
	private readonly pageDocs = createPageDocs({
		storage: this.ctx.storage,
		getSockets: () => this.ctx.getWebSockets(),
		onEdit: (docId) => this.history.noteEdit(docId),
	});

	// サーバー側の機能（AI・サムネイル）がシェイプを読み書きする入口。ページを使うボードは
	// 指定したページ（省略時は先頭ページ）のページ doc、使わないボードはルート doc を開く。
	private readonly boardShapes = createBoardShapes({
		getRootDoc: () => this.yjsSync.getOrCreateDoc(),
		publishRoot: (update) => {
			this.yjsSync.pushUpdate(update);
			this.broadcastRootUpdate(update);
		},
		pageDocs: this.pageDocs,
	});

	// マルチページ移行。移行前のボードを開いたら、初回同期より前にルートの shapes を 1 枚目の
	// ページ doc へ移す（機能フラグ PAGES_MIGRATION で開ける）。移行後にルートへ書かれた
	// シェイプは 1 枚目へ移す。
	private readonly pagesMigration = createPagesMigration({
		enabled: this.env.PAGES_MIGRATION === "true",
		storage: this.ctx.storage,
		root: this.yjsSync,
		pageDocs: this.pageDocs,
		broadcastRoot: (update) => this.broadcastRootUpdate(update),
		commitBeforeMigration: () =>
			this.history.recordCommit({ trigger: "auto", message: "マルチページへの移行前" }),
	});

	/** サーバーで書いたルート doc の update を全接続へ送り、保存と履歴を予約する。 */
	private broadcastRootUpdate(update: Uint8Array): void {
		const msg = new Uint8Array(update.length + 1);
		msg[0] = MSG_YJS_UPDATE;
		msg.set(update, 1);
		this.broadcastAll(msg);
		this.noteBoardEdit();
	}

	/** 移行が要るボードなら移行する。失敗してもボードはページ無しのまま開ける。 */
	private async ensurePagesMigrated(): Promise<void> {
		try {
			await this.pagesMigration.ensureMigrated();
		} catch (e) {
			console.error("[BoardRoom] Pages migration failed:", e);
		}
	}

	/** Yjs の保存を予約し、履歴の自動コミットにも編集を知らせる。 */
	private noteBoardEdit(): void {
		this.yjsSync.scheduleSave();
		this.history.noteEdit();
	}

	// Server-authoritative live sessions (voting / tutorial / card game). State is
	// persisted to DO storage and the reconnect grace uses the DO alarm.
	private sessionsLoaded = false;
	/**
	 * Pending DO storage writes (snapshot persistence + alarm) from session
	 * mutations. `SessionManager` calls persist/setAlarm synchronously; we queue
	 * the promises and {@link flushSessionWrites} awaits them at the end of each
	 * event so a returning handler or a DO eviction can't drop a write — which
	 * would break reconnect-grace and host migration.
	 */
	private sessionWrites: Promise<unknown>[] = [];
	private readonly sessions = new SessionManager({
		send: (userId, msg) => this.sessionSend(userId, msg),
		broadcast: (msg) => this.broadcastAll(this.sessionFrame(msg)),
		now: () => Date.now(),
		genId: () => crypto.randomUUID(),
		persist: (snap) => {
			this.sessionWrites.push(this.ctx.storage.put("sessions", snap));
		},
		setAlarm: (at) => {
			this.sessionWrites.push(
				at == null ? this.ctx.storage.deleteAlarm() : this.ctx.storage.setAlarm(at),
			);
		},
		graceMs: SESSION_GRACE_MS,
		// Registered server-side session types. Add a type's `ServerSessionType`
		// here (server bundle) to make it playable — the client half is registered
		// separately in the web app.
		types: [votingServerType, gatherServerType, respondServerType],
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

	/** Await + clear pending session storage writes so they can't be dropped. */
	private async flushSessionWrites(): Promise<void> {
		if (this.sessionWrites.length === 0) return;
		const writes = this.sessionWrites;
		this.sessionWrites = [];
		await Promise.all(writes);
	}

	/** DO alarm: drive session reconnect-grace expiry. */
	async alarm(): Promise<void> {
		await this.loadSessions();
		this.sessions.onAlarm();
		await this.flushSessionWrites();
	}

	async fetch(request: Request): Promise<Response> {
		await this.yjsSync.loadUpdates();
		await this.partitions.loadFromStorage();
		await this.ensurePagesMigrated();
		const url = new URL(request.url);

		if (url.pathname === "/ws") {
			return this.handleWebSocketUpgrade(request, url);
		}

		// ページの公開範囲が変わった（REST から呼ぶ）。見られなくなったページの購読を外し、
		// つながっている人に権限を読み直してもらう。
		if (url.pathname === "/permissions-changed" && request.method === "POST") {
			await this.handlePermissionsChanged();
			return new Response(null, { status: 204 });
		}

		if (url.pathname === "/ai-place-shapes" && request.method === "POST") {
			return handleAiPlaceShapes(request, {
				openShapes: (pageId) => this.boardShapes.open(pageId),
			});
		}

		if (url.pathname === "/ai-update-shapes" && request.method === "POST") {
			return handleAiUpdateShapes(request, {
				openShapes: (pageId) => this.boardShapes.open(pageId),
			});
		}

		if (url.pathname === "/thumbnail") {
			return handleThumbnail(url, (pageId) => this.boardShapes.open(pageId));
		}

		const historyResponse = await handleHistoryRequest(request, url, this.history);
		if (historyResponse) return historyResponse;

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
		// 書き込み・購読のたびに聞く権限（Worker が確かめた役割）を接続に持たせる
		setSocketAccess(pair[1], readAccessParams(url, this.boardId));

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

		this.clearLegacySnapshots();
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
				// 編集できない人（viewer・公開ボードを見ている人）の書き込みは捨てる
				if (!canEditRoot(ws)) break;
				const applied = await this.yjsSync.applyClientUpdate(payload);
				if (!applied) {
					break;
				}
				this.yjsSync.pushUpdate(payload);
				this.partitions.trackUpdate(payload);
				this.broadcast(ws, data);
				this.noteBoardEdit();
				// ページを使うボードのルート shapes に書かれたもの（古いクライアントなど）は 1 枚目へ移す
				try {
					await this.pagesMigration.moveRootShapes();
				} catch (e) {
					console.error("[BoardRoom] Failed to move root shapes to the first page:", e);
				}
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
				await this.flushSessionWrites();
				break;
			}
			case MSG_SYNC_STEP1: {
				// 休眠から戻った接続でも、初回同期より前に移行を済ませる
				await this.ensurePagesMigrated();
				for (const update of this.yjsSync.getUpdates()) {
					const msg = new Uint8Array(update.length + 1);
					msg[0] = MSG_SYNC_STEP2;
					msg.set(update, 1);
					ws.send(msg);
				}
				this.partitions.sendPartitionMeta(ws);
				break;
			}
			case MSG_DOC_SUBSCRIBE:
			case MSG_DOC_UPDATE:
			case MSG_DOC_UNSUBSCRIBE: {
				const frame = decodeDocFrame(data);
				if (!frame) break;
				if (msgType === MSG_DOC_SUBSCRIBE) {
					// 公開範囲を読めなければ何もしない（見せてよいか分からないので）
					const access = await this.pageAccessOf(ws);
					if (!access) break;
					// 見られないページは購読させず、断ったことを返す
					if (!canViewPage(ws, frame.docId, access.get(frame.docId))) {
						trySend(ws, encodeDocFrame(MSG_DOC_DENIED, frame.docId));
						break;
					}
					await this.pageDocs.handleSubscribe(ws, frame.docId, frame.parts[0]);
				} else if (msgType === MSG_DOC_UPDATE) {
					const [update] = frame.parts;
					if (!update) break;
					// 編集できないページへの書き込みは捨てる（購読はそのまま）
					const access = await this.pageAccessOf(ws);
					if (access && canEditPage(ws, frame.docId, access.get(frame.docId))) {
						await this.pageDocs.handleUpdate(ws, frame.docId, update);
					}
				} else {
					this.pageDocs.handleUnsubscribe(ws, frame.docId);
				}
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
				await this.flushSessionWrites();
			}
		}
		this.pageDocs.handleClose(ws);
		try {
			ws.close(code);
		} catch {
			// 既に閉じているソケットは無視
		}

		if (this.ctx.getWebSockets().length === 0) {
			// 最後の接続が切れた → 未コミットの変更を履歴に残してからドキュメントを破棄する。
			await this.history.flushAutoCommit();
			// コミット中に誰かが接続し直していたら、ドキュメントは使用中なので残す。
			if (this.ctx.getWebSockets().length === 0) this.yjsSync.destroyDoc();
		}
	}

	/**
	 * 接続しているボードのページの公開範囲。読めなかったら null（呼ぶ側は見せない・書かせない）。
	 * 休眠から戻ると空なので、最初に要るときに D1 から読む。
	 */
	private async pageAccessOf(ws: WebSocket): Promise<Map<string, DemoPageAccess> | null> {
		const boardId = socketBoardId(ws);
		if (!boardId) return null;
		if (this.pageAccessCache?.boardId !== boardId) {
			const map = loadPageAccess(drizzle(this.env.DB), boardId);
			const cache = { boardId, map };
			this.pageAccessCache = cache;
			// 失敗したら次に要るときに読み直す
			map.catch(() => {
				if (this.pageAccessCache === cache) this.pageAccessCache = null;
			});
		}
		try {
			return await this.pageAccessCache.map;
		} catch (e) {
			console.error("[BoardRoom] Failed to load page access:", e);
			return null;
		}
	}

	private async handlePermissionsChanged(): Promise<void> {
		this.pageAccessCache = null;
		for (const ws of this.ctx.getWebSockets()) {
			const docIds = subscribedDocIds(ws);
			if (docIds.length === 0) continue;
			// 読めなければ今の購読のまま（断ると、つなぎ直すまで戻せないので）
			const access = await this.pageAccessOf(ws);
			if (!access) continue;
			for (const docId of docIds) {
				if (canViewPage(ws, docId, access.get(docId))) continue;
				this.pageDocs.handleUnsubscribe(ws, docId);
				trySend(ws, encodeDocFrame(MSG_DOC_DENIED, docId));
			}
		}
		this.broadcastAll(new Uint8Array([MSG_PERMISSIONS_CHANGED]));
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

function trySend(ws: WebSocket, data: Uint8Array): void {
	try {
		ws.send(data);
	} catch {
		// 閉じたソケットは無視
	}
}
