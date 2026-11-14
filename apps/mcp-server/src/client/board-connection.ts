/**
 * 1ボードに対する WebSocket + Y.Doc 同期接続
 * board-room.ts のプロトコルに準拠
 */

import type { ShapeData } from "@edv4h/usketch-shared";
import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	getPage,
	isPagedBoard,
	isValidDocId,
	listPages,
	MSG_AWARENESS,
	MSG_DOC_SYNC,
	MSG_DOC_UPDATE,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
	PAGE_AWARENESS_FIELD,
	PAGE_SHAPES_MAP_KEY,
	type PageMeta,
} from "@edv4h/usketch-sync";
import WebSocket from "ws";
import * as Y from "yjs";
import type { McpConfig } from "../config.js";
import {
	aiMotionDuration,
	buildAiMotion,
	finalCursor,
	type MotionStop,
	type Point,
} from "./ai-motion.js";
import { PageSubscriptions } from "./page-subscriptions.js";

/** Identity the AI participant presents as on the board (a normal presence `user`). */
const AI_NAME = "AI 🤖";
const AI_COLOR = "#7c3aed";
/** How long an AI edit stays highlighted before the outline clears. */
const ACTIVITY_HOLD_MS = 1600;

/** TLS + WS アップグレード + 初期同期を含む全体接続タイムアウト */
const OVERALL_CONNECT_TIMEOUT_MS = 10_000;

/** OPEN 後に SYNC_STEP2 を待つ猶予時間（届かなければ空ボードとみなす） */
const POST_OPEN_SYNC_TIMEOUT_MS = 1_000;

/**
 * サーバーは SYNC_STEP1 に、溜めている update を 1 件ずつ SYNC_STEP2 で返す。
 * 最初の 1 件で同期済みにすると残りが届く前にツールが読んでしまうので、
 * SYNC_STEP2 がこの時間来なくなってから同期済みにする。
 */
const SYNC_SETTLE_MS = 100;

/** 指定したページが無い（削除済み・不正な id・ページを使わないボードへの指定）。 */
export class PageNotFoundError extends Error {
	constructor(readonly pageId: string) {
		super(`Page not found: ${pageId}`);
		this.name = "PageNotFoundError";
	}
}

/**
 * シェイプを読み書きする場所。ページを使うボードはページ doc、使わないボードはルート doc。
 * 書くときは `doc.transact` の中で `map` を変える。
 */
export interface ShapesView {
	/** 書くページ。ページを使わないボードは null。 */
	pageId: string | null;
	doc: Y.Doc;
	map: Y.Map<Record<string, unknown>>;
	get(shapeId: string): ShapeData | undefined;
	all(): ShapeData[];
}

function shapesView(pageId: string | null, doc: Y.Doc): ShapesView {
	const map = doc.getMap<Record<string, unknown>>(PAGE_SHAPES_MAP_KEY);
	return {
		pageId,
		doc,
		map,
		get: (id) => map.get(id) as unknown as ShapeData | undefined,
		all: () => [...map.values()] as unknown as ShapeData[],
	};
}

export class BoardConnection {
	readonly doc: Y.Doc;
	/** Presence channel so the AI appears as a participant (cursor/selection/edit). */
	readonly awareness: Awareness;
	private ws: WebSocket | null = null;
	private connected = false;
	private connectPromise: Promise<void> | null = null;
	private aiUserSet = false;
	private activityTimer: ReturnType<typeof setTimeout> | null = null;
	/** Where the AI cursor last came to rest on each page (`""` = no pages) — the start of its next motion. */
	private readonly aiCursors = new Map<string, Point>();
	/** 開いたページ doc。 */
	private readonly pages = new PageSubscriptions({
		send: (frame) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
			this.ws.send(frame);
			return true;
		},
	});

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
	 *
	 * With `stops`, the AI moves through them as ONE continuous `activity.motion`
	 * (cursor glides from where it last rested, outlining each stop's shapes on
	 * arrival). The overlay draws the moving cursor, so the resting `cursor` field is
	 * cleared during playback and set to the end point when the outline clears.
	 * `shapeIds` should then be the final outline set (what non-motion clients show).
	 */
	showAiActivity(opts: {
		shapeIds?: string[];
		cursor?: Point;
		action?: "select" | "edit";
		holdMs?: number;
		stops?: MotionStop[];
		/** 操作したページ。ページを使うボードでは、同じページを見ている人にだけ AI が見える。 */
		pageId?: string | null;
	}): void {
		if (!this.connected) return;
		if (!this.aiUserSet) {
			this.awareness.setLocalStateField("user", { name: AI_NAME, color: AI_COLOR });
			this.aiUserSet = true;
		}
		const pageKey = opts.pageId ?? "";
		if (opts.pageId) this.awareness.setLocalStateField(PAGE_AWARENESS_FIELD, opts.pageId);
		const action = opts.action ?? "edit";
		const motion = opts.stops
			? buildAiMotion({
					id: crypto.randomUUID(),
					stops: opts.stops,
					from: this.aiCursors.get(pageKey),
					action,
				})
			: null;
		const endCursor = motion ? finalCursor(motion) : opts.cursor;
		if (motion) this.awareness.setLocalStateField("cursor", null);
		else if (opts.cursor) this.awareness.setLocalStateField("cursor", opts.cursor);
		if (endCursor) this.aiCursors.set(pageKey, endCursor);

		const ids = opts.shapeIds ?? [];
		this.awareness.setLocalStateField(
			"activity",
			ids.length > 0 || motion
				? { shapeIds: ids, action, label: AI_NAME, ...(motion ? { motion } : {}) }
				: null,
		);
		if (this.activityTimer) clearTimeout(this.activityTimer);
		const playMs = motion ? aiMotionDuration(motion) : 0;
		this.activityTimer = setTimeout(
			() => {
				this.awareness.setLocalStateField("activity", null);
				// Leave the AI cursor resting where the motion ended.
				if (motion && endCursor) this.awareness.setLocalStateField("cursor", endCursor);
				this.activityTimer = null;
			},
			playMs + (opts.holdMs ?? ACTIVITY_HOLD_MS),
		);
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
				// つながり直したときは、開いていたページ doc も購読し直す
				this.pages.resubscribeAll();
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
							// 続きの SYNC_STEP2 を待つ（来るたびに待ち直す）
							if (postOpenSyncTimer) clearTimeout(postOpenSyncTimer);
							postOpenSyncTimer = setTimeout(() => {
								if (settled) return;
								settled = true;
								clearTimeout(overallTimeout);
								this.connected = true;
								resolve();
							}, SYNC_SETTLE_MS);
						}
						break;
					}
					case MSG_AWARENESS: {
						applyAwarenessUpdate(this.awareness, payload, "remote");
						break;
					}
					case MSG_DOC_SYNC:
					case MSG_DOC_UPDATE: {
						this.pages.handleFrame(data);
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

	/** ページを使うボードか。 */
	get isPaged(): boolean {
		return isPagedBoard(this.doc);
	}

	/** ページ一覧（並び順、削除済みを除く）。ページを使わないボードは空。 */
	listPages(): PageMeta[] {
		return this.isPaged ? listPages(this.doc) : [];
	}

	/**
	 * シェイプを読み書きする場所を開く。ページを使うボードは `pageId` のページ（省略時は
	 * 先頭ページ）のページ doc、使わないボードはルート doc。無いページは {@link PageNotFoundError}。
	 */
	async openShapes(pageId?: string | null): Promise<ShapesView> {
		if (!this.isPaged) {
			if (pageId) throw new PageNotFoundError(pageId);
			return shapesView(null, this.doc);
		}
		const target = pageId ?? listPages(this.doc)[0]?.id;
		if (!target || !isValidDocId(target)) throw new PageNotFoundError(target ?? "");
		const page = getPage(this.doc, target);
		if (!page || page.deletedAt !== undefined) throw new PageNotFoundError(target);
		return shapesView(target, await this.pages.open(target));
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
		this.pages.destroy();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.doc.destroy();
	}
}
