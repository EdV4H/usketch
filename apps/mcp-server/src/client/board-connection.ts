/**
 * 1ボードに対する WebSocket + Y.Doc 同期接続
 * board-room.ts のプロトコルに準拠
 */

import type { ShapeData } from "@edv4h/usketch-shared";
import { MSG_SYNC_STEP1, MSG_SYNC_STEP2, MSG_YJS_UPDATE } from "@edv4h/usketch-sync";
import WebSocket from "ws";
import * as Y from "yjs";
import type { McpConfig } from "../config.js";

export class BoardConnection {
	readonly doc: Y.Doc;
	private ws: WebSocket | null = null;
	private connected = false;
	private connectPromise: Promise<void> | null = null;

	constructor(
		readonly boardId: string,
		private readonly config: McpConfig,
	) {
		this.doc = new Y.Doc();

		// ローカル変更を WebSocket 経由で送信
		this.doc.on("update", (update: Uint8Array, origin: unknown) => {
			if (origin === "remote") return;
			this.sendUpdate(update);
		});
	}

	/** 接続を確立し初期同期を待つ */
	async connect(): Promise<void> {
		if (this.connected) return;
		if (this.connectPromise) return this.connectPromise;

		this.connectPromise = new Promise<void>((resolve, reject) => {
			const userId = this.config.devMode ? this.config.devUserId : "mcp-client";
			const wsUrl = `${this.config.wsUrl}/api/boards/${this.boardId}/ws?boardId=${this.boardId}&userId=${userId}${this.config.devMode ? `&devUserId=${userId}` : ""}`;

			const ws = new WebSocket(wsUrl);
			ws.binaryType = "arraybuffer";
			this.ws = ws;

			let syncReceived = false;
			const syncTimeout = setTimeout(() => {
				if (!syncReceived) {
					// タイムアウトしても接続自体は成功とみなす
					this.connected = true;
					resolve();
				}
			}, 5000);

			ws.on("open", () => {
				// MSG_SYNC_STEP1 を送信して初期同期をリクエスト
				ws.send(new Uint8Array([MSG_SYNC_STEP1]));
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
						if (msgType === MSG_SYNC_STEP2 && !syncReceived) {
							syncReceived = true;
							clearTimeout(syncTimeout);
							this.connected = true;
							resolve();
						}
						break;
					}
				}
			});

			ws.on("error", (err) => {
				if (!this.connected) {
					clearTimeout(syncTimeout);
					reject(new Error(`WebSocket connection failed: ${err.message}`));
				}
			});

			ws.on("close", () => {
				this.connected = false;
				this.ws = null;
				this.connectPromise = null;
			});
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

	/** 接続を閉じる */
	destroy(): void {
		this.connected = false;
		this.connectPromise = null;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.doc.destroy();
	}
}
