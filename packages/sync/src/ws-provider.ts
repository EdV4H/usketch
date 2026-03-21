import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";
import {
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "./protocol.js";

export type WsConnectionStatus = "connecting" | "connected" | "disconnected" | "failed";

export interface WsProviderOptions {
	url: string;
	doc: Y.Doc;
}

export interface WsProviderHandle {
	connected: boolean;

	/** Yjs Awareness インスタンス（カーソル等の状態共有に使用） */
	awareness: Awareness;

	/** イベントをブロードキャスト（fire-and-forget、サーバーは中継のみ） */
	broadcast(msg: Record<string, unknown>): void;
	/** リモートからのブロードキャストイベントを受信 */
	onBroadcast(handler: (msg: Record<string, unknown>) => void): () => void;

	/** 接続状態の変化を購読 */
	onStatusChange(handler: (status: WsConnectionStatus) => void): () => void;

	destroy(): void;
}

export function createWsProvider(options: WsProviderOptions): WsProviderHandle {
	const { url, doc } = options;
	const awareness = new Awareness(doc);

	let ws: WebSocket | null = null;
	let destroyed = false;
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	const broadcastListeners = new Set<(msg: Record<string, unknown>) => void>();
	const statusListeners = new Set<(status: WsConnectionStatus) => void>();
	let consecutiveFailures = 0;

	function notifyStatus(status: WsConnectionStatus) {
		for (const listener of statusListeners) {
			listener(status);
		}
	}

	// Awareness → Server: ローカル変更を送信
	function onAwarenessUpdate({
		added,
		updated,
		removed,
	}: {
		added: number[];
		updated: number[];
		removed: number[];
	}) {
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		const changedClients = [...added, ...updated, ...removed];
		const encoded = encodeAwarenessUpdate(awareness, changedClients);
		const msg = new Uint8Array(encoded.length + 1);
		msg[0] = MSG_AWARENESS;
		msg.set(encoded, 1);
		ws.send(msg);
	}

	awareness.on("update", onAwarenessUpdate);

	// Doc → Server: ローカルYjs変更を送信
	function onDocUpdate(update: Uint8Array, origin: unknown) {
		if (origin === "remote" || !ws || ws.readyState !== WebSocket.OPEN) return;
		const msg = new Uint8Array(update.length + 1);
		msg[0] = MSG_YJS_UPDATE;
		msg.set(update, 1);
		ws.send(msg);
	}

	doc.on("update", onDocUpdate);

	function sendBroadcast(msg: Record<string, unknown>) {
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		const encoded = new TextEncoder().encode(JSON.stringify(msg));
		const buf = new Uint8Array(encoded.length + 1);
		buf[0] = MSG_BROADCAST;
		buf.set(encoded, 1);
		ws.send(buf);
	}

	const handle: WsProviderHandle = {
		get connected() {
			return connected;
		},
		awareness,
		broadcast: sendBroadcast,
		onBroadcast(handler: (msg: Record<string, unknown>) => void): () => void {
			broadcastListeners.add(handler);
			return () => broadcastListeners.delete(handler);
		},
		onStatusChange(handler: (status: WsConnectionStatus) => void): () => void {
			statusListeners.add(handler);
			// 現在の状態を即座に通知
			handler(connected ? "connected" : "connecting");
			return () => statusListeners.delete(handler);
		},
		destroy() {
			destroyed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			awareness.off("update", onAwarenessUpdate);
			awareness.destroy();
			doc.off("update", onDocUpdate);
			if (ws) {
				ws.close();
				ws = null;
			}
			broadcastListeners.clear();
			statusListeners.clear();
		},
	};

	function connect() {
		if (destroyed) return;

		notifyStatus("connecting");
		ws = new WebSocket(url);
		ws.binaryType = "arraybuffer";

		ws.addEventListener("open", () => {
			connected = true;
			consecutiveFailures = 0;
			notifyStatus("connected");
			ws?.send(new Uint8Array([MSG_SYNC_STEP1]));
			// 接続時にローカルAwareness状態を送信
			const encoded = encodeAwarenessUpdate(awareness, [doc.clientID]);
			const msg = new Uint8Array(encoded.length + 1);
			msg[0] = MSG_AWARENESS;
			msg.set(encoded, 1);
			ws?.send(msg);
		});

		ws.addEventListener("message", (event) => {
			if (!(event.data instanceof ArrayBuffer)) return;
			const data = new Uint8Array(event.data);
			if (data.length === 0) return;

			const msgType = data[0];
			const payload = data.slice(1);

			switch (msgType) {
				case MSG_SYNC_STEP2:
				case MSG_YJS_UPDATE: {
					Y.applyUpdate(doc, payload, "remote");
					break;
				}
				case MSG_AWARENESS: {
					applyAwarenessUpdate(awareness, payload, "remote");
					break;
				}
				case MSG_BROADCAST: {
					try {
						const msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
						for (const listener of broadcastListeners) {
							listener(msg);
						}
					} catch {
						// 不正なメッセージは無視
					}
					break;
				}
			}
		});

		ws.addEventListener("close", () => {
			const wasConnected = connected;
			connected = false;
			// 切断時にリモートクライアントのAwareness statesをクリア
			const remoteClients = Array.from(awareness.getStates().keys()).filter(
				(id) => id !== doc.clientID,
			);
			removeAwarenessStates(awareness, remoteClients, "remote");

			// 一度も接続できなかった場合（handshake失敗）
			if (!wasConnected) {
				consecutiveFailures++;
			}

			if (!destroyed) {
				// 連続3回失敗したら「failed」として通知し、リトライを停止
				if (consecutiveFailures >= 3) {
					notifyStatus("failed");
				} else {
					notifyStatus("disconnected");
					reconnectTimer = setTimeout(connect, 3000);
				}
			}
		});

		ws.addEventListener("error", () => {
			ws?.close();
		});
	}

	connect();

	return handle;
}
