import {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates,
} from "y-protocols/awareness";
import * as Y from "yjs";
import {
	decodeDocFrame,
	encodeDocFrame,
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_SYNC,
	MSG_DOC_UNSUBSCRIBE,
	MSG_DOC_UPDATE,
	MSG_PARTITION_META,
	MSG_PARTITION_REQUEST,
	MSG_SESSION,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "./protocol.js";

export type WsConnectionStatus = "connecting" | "connected" | "disconnected" | "failed";

export interface WsProviderOptions {
	url: string;
	doc: Y.Doc;
}

export interface PartitionMeta {
	partitions: string[];
	activePartition: string;
	shapeCount: Record<string, number>;
}

/** {@link WsProviderHandle.subscribeDoc} の戻り値。 */
export interface DocSubscription {
	/** 購読している doc id。 */
	readonly docId: string;
	/**
	 * サーバーとの最初の同期（サーバーにある差分を受け取った時点）で解決する。
	 * 接続前に購読した場合は、接続して同期できた時点で解決する。
	 */
	readonly whenSynced: Promise<void>;
	/** 購読をやめる（サーバーにも伝える）。doc 自体は破棄しない。 */
	unsubscribe(): void;
}

export interface WsProviderHandle {
	connected: boolean;

	/** Yjs Awareness インスタンス（カーソル等の状態共有に使用） */
	awareness: Awareness;

	/** イベントをブロードキャスト（fire-and-forget、サーバーは中継のみ） */
	broadcast(msg: Record<string, unknown>): void;
	/** リモートからのブロードキャストイベントを受信 */
	onBroadcast(handler: (msg: Record<string, unknown>) => void): () => void;

	/** セッション意図をサーバーへ送信（server-authoritative。SessionManager が処理） */
	sendSession(msg: Record<string, unknown>): void;
	/** サーバーからのセッションメッセージを受信 */
	onSession(handler: (msg: Record<string, unknown>) => void): () => void;

	/** 接続状態の変化を購読 */
	onStatusChange(handler: (status: WsConnectionStatus) => void): () => void;

	/**
	 * ルート doc とは別の Y.Doc（ページ doc など）を `docId` で購読し、サーバーと同期する。
	 * 再接続時は自動で購読し直す。同じ `docId` を二重に購読するとエラー。
	 */
	subscribeDoc(docId: string, doc: Y.Doc): DocSubscription;

	/** 追加パーティションの読み込みを要求 */
	requestPartition(names: string[]): void;
	/** サーバーからのパーティションメタデータを購読 */
	onPartitionMeta(handler: (meta: PartitionMeta) => void): () => void;

	destroy(): void;
}

/** 中身の無い update（`[0, 0]`: 構造体 0 件・削除 0 件）か。 */
function hasContent(update: Uint8Array): boolean {
	return !(update.length === 2 && update[0] === 0 && update[1] === 0);
}

export function createWsProvider(options: WsProviderOptions): WsProviderHandle {
	const { url, doc } = options;
	const awareness = new Awareness(doc);

	let ws: WebSocket | null = null;
	let destroyed = false;
	let connected = false;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	const broadcastListeners = new Set<(msg: Record<string, unknown>) => void>();
	const sessionListeners = new Set<(msg: Record<string, unknown>) => void>();
	const statusListeners = new Set<(status: WsConnectionStatus) => void>();
	const partitionMetaListeners = new Set<(meta: PartitionMeta) => void>();
	let consecutiveFailures = 0;

	/** 購読中の個別 doc。key は doc id。 */
	const subscribedDocs = new Map<
		string,
		{ doc: Y.Doc; onUpdate: (update: Uint8Array, origin: unknown) => void; synced: () => void }
	>();

	function sendRaw(data: Uint8Array<ArrayBuffer>): boolean {
		if (!ws || ws.readyState !== WebSocket.OPEN) return false;
		ws.send(data);
		return true;
	}

	/** 個別 doc の購読をサーバーへ送る（state vector 付き）。 */
	function sendDocSubscribe(docId: string, doc: Y.Doc): void {
		sendRaw(encodeDocFrame(MSG_DOC_SUBSCRIBE, docId, [Y.encodeStateVector(doc)]));
	}

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

	function sendSession(msg: Record<string, unknown>) {
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		const encoded = new TextEncoder().encode(JSON.stringify(msg));
		const buf = new Uint8Array(encoded.length + 1);
		buf[0] = MSG_SESSION;
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
		sendSession,
		onSession(handler: (msg: Record<string, unknown>) => void): () => void {
			sessionListeners.add(handler);
			return () => sessionListeners.delete(handler);
		},
		onStatusChange(handler: (status: WsConnectionStatus) => void): () => void {
			statusListeners.add(handler);
			// 現在の状態を即座に通知
			handler(connected ? "connected" : "connecting");
			return () => statusListeners.delete(handler);
		},
		subscribeDoc(docId: string, subDoc: Y.Doc): DocSubscription {
			if (subscribedDocs.has(docId)) throw new Error(`Doc already subscribed: ${docId}`);
			// 先に組み立てて、id が不正ならここで例外にする
			const subscribeFrame = encodeDocFrame(MSG_DOC_SUBSCRIBE, docId, [
				Y.encodeStateVector(subDoc),
			]);
			let resolveSynced: () => void = () => {};
			const whenSynced = new Promise<void>((resolve) => {
				resolveSynced = resolve;
			});
			const onUpdate = (update: Uint8Array, origin: unknown) => {
				if (origin === "remote") return;
				sendRaw(encodeDocFrame(MSG_DOC_UPDATE, docId, [update]));
			};
			subDoc.on("update", onUpdate);
			subscribedDocs.set(docId, { doc: subDoc, onUpdate, synced: resolveSynced });
			sendRaw(subscribeFrame);
			return {
				docId,
				whenSynced,
				unsubscribe() {
					const entry = subscribedDocs.get(docId);
					if (!entry || entry.doc !== subDoc) return;
					subDoc.off("update", onUpdate);
					subscribedDocs.delete(docId);
					sendRaw(encodeDocFrame(MSG_DOC_UNSUBSCRIBE, docId));
				},
			};
		},
		requestPartition(names: string[]): void {
			if (!ws || ws.readyState !== WebSocket.OPEN) return;
			const encoded = new TextEncoder().encode(JSON.stringify({ partitions: names }));
			const buf = new Uint8Array(encoded.length + 1);
			buf[0] = MSG_PARTITION_REQUEST;
			buf.set(encoded, 1);
			ws.send(buf);
		},
		onPartitionMeta(handler: (meta: PartitionMeta) => void): () => void {
			partitionMetaListeners.add(handler);
			return () => partitionMetaListeners.delete(handler);
		},
		destroy() {
			destroyed = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			awareness.off("update", onAwarenessUpdate);
			awareness.destroy();
			doc.off("update", onDocUpdate);
			for (const entry of subscribedDocs.values()) entry.doc.off("update", entry.onUpdate);
			subscribedDocs.clear();
			if (ws) {
				ws.close();
				ws = null;
			}
			broadcastListeners.clear();
			sessionListeners.clear();
			statusListeners.clear();
			partitionMetaListeners.clear();
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
			// 個別 doc は接続のたびに購読し直す（切断中の編集は DOC_SYNC の後に送り返す）
			for (const [docId, entry] of subscribedDocs) sendDocSubscribe(docId, entry.doc);
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
					try {
						Y.applyUpdate(doc, payload, "remote");
					} catch (e) {
						console.error("[WsProvider] Corrupt Yjs update from server, skipping:", e);
					}
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
				case MSG_SESSION: {
					try {
						const msg = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
						for (const listener of sessionListeners) {
							listener(msg);
						}
					} catch {
						// 不正なメッセージは無視
					}
					break;
				}
				case MSG_DOC_SYNC:
				case MSG_DOC_UPDATE: {
					const frame = decodeDocFrame(data);
					const entry = frame && subscribedDocs.get(frame.docId);
					if (!frame || !entry) break;
					const [update, serverStateVector] = frame.parts;
					try {
						if (update && update.length > 0) Y.applyUpdate(entry.doc, update, "remote");
					} catch (e) {
						console.error("[WsProvider] Corrupt doc update from server, skipping:", e);
					}
					if (msgType === MSG_DOC_SYNC) {
						// サーバーに足りない分（オフライン中の編集など）を送り返す
						if (serverStateVector) {
							const missing = Y.encodeStateAsUpdate(entry.doc, serverStateVector);
							if (hasContent(missing)) {
								sendRaw(encodeDocFrame(MSG_DOC_UPDATE, frame.docId, [missing]));
							}
						}
						entry.synced();
					}
					break;
				}
				case MSG_PARTITION_META: {
					try {
						const meta = JSON.parse(new TextDecoder().decode(payload)) as PartitionMeta;
						for (const listener of partitionMetaListeners) {
							listener(meta);
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
				notifyStatus("disconnected");
				// Exponential backoff with jitter: 1s, 2s, 4s, 8s, ... 最大30s
				const baseDelay = Math.min(1000 * 2 ** consecutiveFailures, 30000);
				const jitter = Math.random() * 1000;
				reconnectTimer = setTimeout(connect, baseDelay + jitter);
			}
		});

		ws.addEventListener("error", () => {
			ws?.close();
		});
	}

	connect();

	return handle;
}
