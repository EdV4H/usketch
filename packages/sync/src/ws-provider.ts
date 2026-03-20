import * as Y from "yjs";
import { MSG_BROADCAST, MSG_SYNC_STEP1, MSG_SYNC_STEP2, MSG_YJS_UPDATE } from "./protocol.js";

export interface AwarenessState {
	userId: string;
	name: string;
	color: string;
	cursor: { x: number; y: number } | null;
}

export interface TransientMessage {
	id: string;
	type: string;
	sourceUserId: string;
	position: { x: number; y: number };
	data: Record<string, unknown>;
	ttl?: number;
}

/** MSG_BROADCAST のペイロード。kind で中身を区別する */
export type BroadcastMessage =
	| { kind: "awareness"; payload: AwarenessState }
	| { kind: "transient"; payload: TransientMessage };

export interface WsProviderOptions {
	url: string;
	doc: Y.Doc;
}

export interface WsProviderHandle {
	connected: boolean;

	/** 汎用ブロードキャスト（サーバーは中身を見ずに中継するだけ） */
	broadcast(msg: BroadcastMessage): void;
	/** 汎用ブロードキャスト受信 */
	onBroadcast(handler: (msg: BroadcastMessage) => void): () => void;

	/** Awarenessヘルパー: ローカル状態を更新してブロードキャスト */
	setAwareness(state: AwarenessState): void;
	/** Awarenessヘルパー: リモート状態変更を監視 */
	onAwarenessChange(handler: (states: Map<string, AwarenessState>) => void): () => void;
	/** Transientヘルパー: オブジェクトをブロードキャスト */
	broadcastTransient(msg: TransientMessage): void;
	/** Transientヘルパー: リモートオブジェクトを監視 */
	onTransient(handler: (msg: TransientMessage) => void): () => void;

	destroy(): void;
}

export function createWsProvider(options: WsProviderOptions): WsProviderHandle {
	const { url, doc } = options;
	let ws: WebSocket | null = null;
	let destroyed = false;
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	// Broadcast listeners
	const broadcastListeners = new Set<(msg: BroadcastMessage) => void>();

	// Awareness（broadcastの上に構築）
	let localAwareness: AwarenessState | null = null;
	const remoteAwareness = new Map<string, AwarenessState>();
	const awarenessListeners = new Set<(states: Map<string, AwarenessState>) => void>();

	// Transient（broadcastの上に構築）
	const transientListeners = new Set<(msg: TransientMessage) => void>();

	function notifyAwareness() {
		for (const listener of awarenessListeners) {
			listener(remoteAwareness);
		}
	}

	function sendBroadcast(msg: BroadcastMessage) {
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		const encoded = new TextEncoder().encode(JSON.stringify(msg));
		const buf = new Uint8Array(encoded.length + 1);
		buf[0] = MSG_BROADCAST;
		buf.set(encoded, 1);
		ws.send(buf);
	}

	function handleBroadcast(msg: BroadcastMessage) {
		// 汎用リスナーに通知
		for (const listener of broadcastListeners) {
			listener(msg);
		}
		// 型別リスナーに通知
		switch (msg.kind) {
			case "awareness": {
				const state = msg.payload;
				if (state.userId) {
					remoteAwareness.set(state.userId, state);
					notifyAwareness();
				}
				break;
			}
			case "transient": {
				for (const listener of transientListeners) {
					listener(msg.payload);
				}
				break;
			}
		}
	}

	const handle: WsProviderHandle = {
		get connected() {
			return connected;
		},

		broadcast: sendBroadcast,
		onBroadcast(handler: (msg: BroadcastMessage) => void): () => void {
			broadcastListeners.add(handler);
			return () => broadcastListeners.delete(handler);
		},

		// Awareness ヘルパー
		setAwareness(state: AwarenessState) {
			localAwareness = state;
			sendBroadcast({ kind: "awareness", payload: state });
		},
		onAwarenessChange(handler: (states: Map<string, AwarenessState>) => void): () => void {
			awarenessListeners.add(handler);
			return () => awarenessListeners.delete(handler);
		},

		// Transient ヘルパー
		broadcastTransient(msg: TransientMessage) {
			sendBroadcast({ kind: "transient", payload: msg });
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
			broadcastListeners.clear();
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
				case MSG_BROADCAST: {
					try {
						const msg = JSON.parse(new TextDecoder().decode(payload)) as BroadcastMessage;
						handleBroadcast(msg);
					} catch {
						// 不正なメッセージは無視
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
