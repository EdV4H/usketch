/**
 * 1ボードに対する WebSocket + Y.Doc 同期接続
 * board-room.ts のプロトコルに準拠
 */

import type { ShapeData } from "@edv4h/usketch-shared";
import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	MSG_AWARENESS,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import WebSocket from "ws";
import * as Y from "yjs";
import type { McpConfig } from "../config.js";

/** Identity the AI participant presents as on the board (a normal presence `user`). */
const AI_NAME = "AI 🤖";
const AI_COLOR = "#7c3aed";
/** How long an AI edit stays highlighted before the outline clears. */
const ACTIVITY_HOLD_MS = 1600;

/** TLS + WS アップグレード + 初期同期を含む全体接続タイムアウト */
const OVERALL_CONNECT_TIMEOUT_MS = 10_000;

/** OPEN 後に SYNC_STEP2 を待つ猶予時間（届かなければ空ボードとみなす） */
const POST_OPEN_SYNC_TIMEOUT_MS = 1_000;

export class BoardConnection {
	readonly doc: Y.Doc;
	/** Presence channel so the AI appears as a participant (cursor/selection/edit). */
	readonly awareness: Awareness;
	private ws: WebSocket | null = null;
	private connected = false;
	private connectPromise: Promise<void> | null = null;
	private aiUserSet = false;
	private activityTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		readonly boardId: string,
		private readonly config: McpConfig,
	) {
		this.doc = new Y.Doc();
		this.awareness = new Awareness(this.doc);

		// ローカル変更を WebSocket 経由で送信
		this.doc.on("update", (update: Uint8Array, origin: unknown) => {
			if (origin === "remote") return;
			this.sendUpdate(update);
		});

		// Presence (awareness) の変更も WebSocket 経由で送信（board-room が中継）
		this.awareness.on(
			"update",
			(
				{ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
				origin: unknown,
			) => {
				if (origin === "remote") return;
				const changed = [...added, ...updated, ...removed];
				this.sendAwareness(encodeAwarenessUpdate(this.awareness, changed));
			},
		);
	}

	/**
	 * Show the AI editing/selecting `shapeIds` as a live presence participant on the
	 * canvas (feature #960): sets the AI `user` (once), an optional `cursor`, and the
	 * `activity` field the web overlay renders, then auto-clears the outline after a
	 * short hold so it reads as "AI just did this". No-op while disconnected — there's
	 * no socket to broadcast on, and we don't want to leave a pending timer or stale
	 * local state that would flush on reconnect.
	 */
	showAiActivity(opts: {
		shapeIds?: string[];
		cursor?: { x: number; y: number };
		action?: "select" | "edit";
		holdMs?: number;
	}): void {
		if (!this.connected) return;
		if (!this.aiUserSet) {
			this.awareness.setLocalStateField("user", { name: AI_NAME, color: AI_COLOR });
			this.aiUserSet = true;
		}
		if (opts.cursor) this.awareness.setLocalStateField("cursor", opts.cursor);
		const ids = opts.shapeIds ?? [];
		this.awareness.setLocalStateField(
			"activity",
			ids.length > 0 ? { shapeIds: ids, action: opts.action ?? "edit", label: AI_NAME } : null,
		);
		if (this.activityTimer) clearTimeout(this.activityTimer);
		this.activityTimer = setTimeout(() => {
			this.awareness.setLocalStateField("activity", null);
			this.activityTimer = null;
		}, opts.holdMs ?? ACTIVITY_HOLD_MS);
	}

	/** 接続を確立し初期同期を待つ */
	async connect(): Promise<void> {
		if (this.connected) return;
		if (this.connectPromise) return this.connectPromise;

		const promise = new Promise<void>((resolve, reject) => {
			const userId = this.config.devMode ? this.config.devUserId : "mcp-client";
			const wsUrl = `${this.config.wsUrl}/api/boards/${this.boardId}/ws?boardId=${this.boardId}&userId=${userId}${this.config.devMode ? `&devUserId=${userId}` : ""}`;

			const wsOptions: WebSocket.ClientOptions = {};
			if (!this.config.devMode && this.config.apiToken) {
				wsOptions.headers = { Authorization: `Bearer ${this.config.apiToken}` };
			}
			const ws = new WebSocket(wsUrl, wsOptions);
			ws.binaryType = "arraybuffer";
			this.ws = ws;

			let settled = false;
			let postOpenSyncTimer: ReturnType<typeof setTimeout> | null = null;

			// タイムアウト時にハンドシェイク中のソケットを確実に破棄する
			const terminateSocket = () => {
				try {
					ws.terminate();
				} catch {
					// already closed
				}
				if (this.ws === ws) this.ws = null;
			};

			// 全体の接続タイムアウト（TLS + WS アップグレード + 初期同期を含む）
			const overallTimeout = setTimeout(() => {
				if (!settled) {
					settled = true;
					if (postOpenSyncTimer) clearTimeout(postOpenSyncTimer);
					terminateSocket();
					reject(new Error("WebSocket connection timed out"));
				}
			}, OVERALL_CONNECT_TIMEOUT_MS);

			const clearTimers = () => {
				clearTimeout(overallTimeout);
				if (postOpenSyncTimer) clearTimeout(postOpenSyncTimer);
			};

			ws.on("open", () => {
				// 既に settle 済みなら何もしない（タイムアウト後の遅延 open など）
				if (settled) return;
				ws.send(new Uint8Array([MSG_SYNC_STEP1]));
				// OPEN 後に短いウィンドウだけ SYNC_STEP2 を待つ。
				// 届かなければ空ボードとみなして resolve する。
				postOpenSyncTimer = setTimeout(() => {
					if (!settled && ws.readyState === WebSocket.OPEN) {
						settled = true;
						clearTimeout(overallTimeout);
						this.connected = true;
						resolve();
					}
				}, POST_OPEN_SYNC_TIMEOUT_MS);
			});

			ws.on("message", (raw: ArrayBuffer | Buffer) => {
				const data = new Uint8Array(
					raw instanceof ArrayBuffer
						? raw
						: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
				);
				if (data.length === 0) return;

				const msgType = data[0];
				const payload = data.slice(1);

				switch (msgType) {
					case MSG_SYNC_STEP2:
					case MSG_YJS_UPDATE: {
						Y.applyUpdate(this.doc, payload, "remote");
						if (msgType === MSG_SYNC_STEP2 && !settled) {
							settled = true;
							clearTimers();
							this.connected = true;
							resolve();
						}
						break;
					}
					case MSG_AWARENESS: {
						applyAwarenessUpdate(this.awareness, payload, "remote");
						break;
					}
				}
			});

			ws.on("unexpected-response", (_req, res) => {
				if (!settled) {
					settled = true;
					clearTimers();
					terminateSocket();
					reject(new Error(`WebSocket upgrade rejected: ${res.statusCode}`));
				}
			});

			ws.on("error", (err) => {
				if (!settled) {
					settled = true;
					clearTimers();
					terminateSocket();
					reject(new Error(`WebSocket connection failed: ${err.message}`));
				}
			});

			ws.on("close", () => {
				if (!settled) {
					settled = true;
					clearTimers();
					reject(new Error("WebSocket closed before sync completed"));
				}
				this.connected = false;
				this.ws = null;
				this.connectPromise = null;
			});
		});

		// reject 時に connectPromise をクリアして再試行可能にする
		this.connectPromise = promise.catch((err) => {
			this.connectPromise = null;
			throw err;
		});

		return this.connectPromise;
	}

	get isConnected(): boolean {
		return this.connected;
	}

	/** Y.Doc の shapes マップを取得 */
	getShapesMap(): Y.Map<Record<string, unknown>> {
		return this.doc.getMap<Record<string, unknown>>("shapes");
	}

	/** 全シェイプを取得 */
	getAllShapes(): ShapeData[] {
		const shapesMap = this.getShapesMap();
		const shapes: ShapeData[] = [];
		for (const [, value] of shapesMap) {
			shapes.push(value as unknown as ShapeData);
		}
		return shapes;
	}

	/** 特定シェイプを取得 */
	getShape(shapeId: string): ShapeData | undefined {
		const shapesMap = this.getShapesMap();
		const data = shapesMap.get(shapeId);
		return data ? (data as unknown as ShapeData) : undefined;
	}

	/** Yjs update を WebSocket で送信 */
	private sendUpdate(update: Uint8Array): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		const msg = new Uint8Array(update.length + 1);
		msg[0] = MSG_YJS_UPDATE;
		msg.set(update, 1);
		this.ws.send(msg);
	}

	/** Awareness update を WebSocket で送信（board-room が他クライアントへ中継） */
	private sendAwareness(payload: Uint8Array): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		const msg = new Uint8Array(payload.length + 1);
		msg[0] = MSG_AWARENESS;
		msg.set(payload, 1);
		this.ws.send(msg);
	}

	/** 接続を閉じる */
	destroy(): void {
		this.connected = false;
		this.connectPromise = null;
		if (this.activityTimer) {
			clearTimeout(this.activityTimer);
			this.activityTimer = null;
		}
		this.awareness.destroy();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.doc.destroy();
	}
}
