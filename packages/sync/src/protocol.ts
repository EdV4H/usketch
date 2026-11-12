/**
 * WebSocketメッセージプロトコル
 * クライアント（ws-provider）とサーバー（board-room DO）で共有
 *
 * - SYNC_STEP1/2: 初期同期（クライアントがSTEP1を送信→サーバーが蓄積updateをSTEP2で返送）
 * - YJS_UPDATE: Yjs差分更新（蓄積＋ブロードキャスト）
 * - AWARENESS: Yjs Awareness状態の共有（最新値を保持、切断時に自動消滅）
 * - BROADCAST: イベントの中継（fire-and-forget、蓄積なし）
 * - PARTITION_REQUEST: クライアント→サーバー、追加パーティション要求（JSON payload）
 * - PARTITION_META: サーバー→クライアント、利用可能パーティション一覧（JSON payload）
 * - DOC_*: ルート doc とは別に同期する個別の Y.Doc（ページ doc）。先頭に doc id を持つ
 *   （{@link encodeDocFrame}）。ルート doc 用のメッセージ（0〜7）は変えない
 */
export const MSG_SYNC_STEP1 = 0;
export const MSG_SYNC_STEP2 = 1;
export const MSG_YJS_UPDATE = 2;
export const MSG_AWARENESS = 3;
export const MSG_BROADCAST = 4;
export const MSG_PARTITION_REQUEST = 5;
export const MSG_PARTITION_META = 6;
/**
 * SESSION: server-authoritative live sessions (voting / tutorial / card game).
 * Bidirectional JSON payload; unlike BROADCAST this is **processed by the
 * server** (SessionManager), not blind-relayed. See `@edv4h/usketch-session-protocol`.
 */
export const MSG_SESSION = 7;

/**
 * DOC_SUBSCRIBE: クライアント→サーバー。doc の購読を始める。
 * parts = [クライアントの state vector]。サーバーは {@link MSG_DOC_SYNC} で返す。
 */
export const MSG_DOC_SUBSCRIBE = 8;
/**
 * DOC_SYNC: サーバー→クライアント。購読への返事。
 * parts = [クライアントに足りない差分 update, サーバーの state vector]。
 * クライアントはサーバーに足りない分を {@link MSG_DOC_UPDATE} で送り返す。
 */
export const MSG_DOC_SYNC = 9;
/** DOC_UPDATE: 双方向。doc の Yjs update。parts = [update]。 */
export const MSG_DOC_UPDATE = 10;
/** DOC_UNSUBSCRIBE: クライアント→サーバー。doc の購読をやめる。parts = []。 */
export const MSG_DOC_UNSUBSCRIBE = 11;

/** doc id に使える文字（区切りやストレージキーと衝突しないよう英数字と `_` `-` だけ）。 */
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** `id` が DOC_* メッセージで使える doc id か。 */
export function isValidDocId(id: string): boolean {
	return DOC_ID_PATTERN.test(id);
}

/** DOC_* メッセージを復号した結果。 */
export interface DocFrame {
	type: number;
	docId: string;
	parts: Uint8Array[];
}

/**
 * DOC_* メッセージを組み立てる。
 * 形式: `[type][id 長 (1 byte)][id (UTF-8)]` の後に、各 part を `[長さ (uint32 BE)][中身]` で並べる。
 */
export function encodeDocFrame(
	type: number,
	docId: string,
	parts: readonly Uint8Array[] = [],
): Uint8Array<ArrayBuffer> {
	if (!isValidDocId(docId)) throw new Error(`Invalid doc id: ${docId}`);
	const id = new TextEncoder().encode(docId);
	let size = 2 + id.length;
	for (const part of parts) size += 4 + part.length;
	const out = new Uint8Array(size);
	const view = new DataView(out.buffer);
	out[0] = type;
	out[1] = id.length;
	out.set(id, 2);
	let offset = 2 + id.length;
	for (const part of parts) {
		view.setUint32(offset, part.length);
		out.set(part, offset + 4);
		offset += 4 + part.length;
	}
	return out;
}

/** {@link encodeDocFrame} の逆。形式が壊れていれば `null`。 */
export function decodeDocFrame(data: Uint8Array): DocFrame | null {
	if (data.length < 2) return null;
	const type = data[0];
	const idLength = data[1];
	if (data.length < 2 + idLength) return null;
	const docId = new TextDecoder().decode(data.subarray(2, 2 + idLength));
	if (!isValidDocId(docId)) return null;
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	const parts: Uint8Array[] = [];
	let offset = 2 + idLength;
	while (offset < data.length) {
		if (offset + 4 > data.length) return null;
		const length = view.getUint32(offset);
		const start = offset + 4;
		if (start + length > data.length) return null;
		parts.push(data.slice(start, start + length));
		offset = start + length;
	}
	return { type, docId, parts };
}
