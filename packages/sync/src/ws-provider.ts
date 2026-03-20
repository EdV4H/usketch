import * as Y from "yjs";
import {
	MSG_AWARENESS,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_TRANSIENT,
	MSG_YJS_UPDATE,
} from "./protocol.js";

export interface AwarenessState {
	userId: string;
	name: string;
	color: string;
	cursor: { x: number; y: number } | null;
}

export interface WsProviderOptions {
	url: string;
	doc: Y.Doc;
}

/** WebSocket経由で送受信するTransientオブジェクト */
export interface TransientMessage {
	id: string;
	type: string;
	sourceUserId: string;
	position: { x: number; y: number };
	data: Record<string, unknown>;
	ttl?: number;
}

export interface WsProviderHandle {
	connected: boolean;
	/** ローカルのAwareness状態を更新してブロードキャスト */
	setAwareness(state: AwarenessState): void;
	/** リモートのAwareness状態変更を監視 */
	onAwarenessChange(handler: (states: Map<string, AwarenessState>) => void): () => void;
	/** Transientオブジェクトをブロードキャスト */
	broadcastTransient(msg: TransientMessage): void;
	/** リモートのTransientオブジェクトを監視 */
	onTransient(handler: (msg: TransientMessage) => void): () => void;
	destroy(): void;
}

export function createWsProvider(options: WsProviderOptions): WsProviderHandle {
	const { url, doc } = options;
	let ws: WebSocket | null = null;
	let destroyed = false;
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	// Awareness管理
	let localAwareness: AwarenessState | null = null;
	const remoteAwareness = new Map<string, AwarenessState>();
	const awarenessListeners = new Set<(states: Map<string, AwarenessState>) => void>();

	// Transient管理
	const transientListeners = new Set<(msg: TransientMessage) => void>();

	function notifyAwareness() {
		for (const listener of awarenessListeners) {
			listener(remoteAwareness);
		}
	}

	const handle: WsProviderHandle = {
		get connected() {
			return connected;
		},
		setAwareness(state: AwarenessState) {
			localAwareness = state;
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			const encoded = new TextEncoder().encode(JSON.stringify(state));
			const msg = new Uint8Array(encoded.length + 1);
			msg[0] = MSG_AWARENESS;
			msg.set(encoded, 1);
			ws.send(msg);
		},
		onAwarenessChange(handler: (states: Map<string, AwarenessState>) => void): () => void {
			awarenessListeners.add(handler);
			return () => awarenessListeners.delete(handler);
		},
		broadcastTransient(msg: TransientMessage) {
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			const encoded = new TextEncoder().encode(JSON.stringify(msg));
			const buf = new Uint8Array(encoded.length + 1);
			buf[0] = MSG_TRANSIENT;
			buf.set(encoded, 1);
			ws.send(buf);
		},
		onTransient(handler: (msg: TransientMessage) => void): () => void {
			transientListeners.add(handler);
			return () => transientListeners.delete(handler);
		},
		destroy() {
			destroyed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) {
				ws.close();
				ws = null;
			}
			doc.off("update", onDocUpdate);
			awarenessListeners.clear();
			transientListeners.clear();
			remoteAwareness.clear();
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
			if (localAwareness) {
				handle.setAwareness(localAwareness);
			}
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
					try {
						const state = JSON.parse(new TextDecoder().decode(payload)) as AwarenessState;
						if (state.userId) {
							remoteAwareness.set(state.userId, state);
							notifyAwareness();
						}
					} catch {
						// 不正なAwarenessメッセージは無視
					}
					break;
				}
				case MSG_TRANSIENT: {
					try {
						const msg = JSON.parse(new TextDecoder().decode(payload)) as TransientMessage;
						for (const listener of transientListeners) {
							listener(msg);
						}
					} catch {
						// 不正なTransientメッセージは無視
					}
					break;
				}
			}
		});

		ws.addEventListener("close", () => {
			connected = false;
			remoteAwareness.clear();
			notifyAwareness();
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
