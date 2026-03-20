import * as Y from "yjs";

/**
 * メッセージプロトコル（server/board-room.tsと一致）
 */
const MSG_SYNC_STEP1 = 0;
const MSG_SYNC_STEP2 = 1;
const MSG_YJS_UPDATE = 2;
const MSG_AWARENESS = 3;

export interface WsProviderOptions {
	url: string;
	doc: Y.Doc;
	awareness?: { update: Uint8Array; onChange: (handler: (data: Uint8Array) => void) => void };
}

export interface WsProviderHandle {
	connected: boolean;
	destroy(): void;
}

export function createWsProvider(options: WsProviderOptions): WsProviderHandle {
	const { url, doc } = options;
	let ws: WebSocket | null = null;
	let destroyed = false;
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	const handle: WsProviderHandle = {
		get connected() {
			return connected;
		},
		destroy() {
			destroyed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) {
				ws.close();
				ws = null;
			}
			doc.off("update", onDocUpdate);
		},
	};

	// Doc → Server: ローカル変更をサーバーに送信
	function onDocUpdate(update: Uint8Array, origin: unknown) {
		// リモートから来た更新は再送しない
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
			// 同期リクエストを送信
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
					// リモート更新をdocに適用（origin: "remote"でループ防止）
					Y.applyUpdate(doc, payload, "remote");
					break;
				}
				case MSG_AWARENESS: {
					// TODO: Awareness更新のハンドリング（Week 5-6 後半）
					break;
				}
			}
		});

		ws.addEventListener("close", () => {
			connected = false;
			if (!destroyed) {
				// 自動再接続（3秒後）
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
