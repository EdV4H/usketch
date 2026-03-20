import * as Y from "yjs";
import { MSG_BROADCAST, MSG_SYNC_STEP1, MSG_SYNC_STEP2, MSG_YJS_UPDATE } from "./protocol.js";

export interface WsProviderOptions {
	url: string;
	doc: Y.Doc;
}

export interface WsProviderHandle {
	connected: boolean;
	/** JSONメッセージをブロードキャスト（サーバーは中身を見ずに中継） */
	broadcast(msg: Record<string, unknown>): void;
	/** リモートからのブロードキャストを受信 */
	onBroadcast(handler: (msg: Record<string, unknown>) => void): () => void;
	destroy(): void;
}

export function createWsProvider(options: WsProviderOptions): WsProviderHandle {
	const { url, doc } = options;
	let ws: WebSocket | null = null;
	let destroyed = false;
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	const broadcastListeners = new Set<(msg: Record<string, unknown>) => void>();

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
		broadcast: sendBroadcast,
		onBroadcast(handler: (msg: Record<string, unknown>) => void): () => void {
			broadcastListeners.add(handler);
			return () => broadcastListeners.delete(handler);
		},
		destroy() {
			destroyed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) {
				ws.close();
				ws = null;
			}
			doc.off("update", onDocUpdate);
			broadcastListeners.clear();
		},
	};

	function onDocUpdate(update: Uint8Array, origin: unknown) {
		if (origin === "remote" || !ws || ws.readyState !== WebSocket.OPEN) return;
		const msg = new Uint8Array(update.length + 1);
		msg[0] = MSG_YJS_UPDATE;
		msg.set(update, 1);
		ws.send(msg);
	}

	doc.on("update", onDocUpdate);

	function connect() {
		if (destroyed) return;

		ws = new WebSocket(url);
		ws.binaryType = "arraybuffer";

		ws.addEventListener("open", () => {
			connected = true;
			ws?.send(new Uint8Array([MSG_SYNC_STEP1]));
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
			connected = false;
			if (!destroyed) {
				reconnectTimer = setTimeout(connect, 3000);
			}
		});

		ws.addEventListener("error", () => {
			ws?.close();
		});
	}

	connect();

	return handle;
}
