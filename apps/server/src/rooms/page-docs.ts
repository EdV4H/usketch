/**
 * ページ doc（ルート doc とは別に同期する個別の Y.Doc）の購読・同期・保存。
 *
 * - 最初の購読で storage から読み込み、購読者がいなくなって保存も済んだらメモリから外す
 * - 状態は doc ごとに `yjs_page:<docId>` へ分割保存する（圧縮・デバウンスはルート doc と同じ仕組み）
 * - どの接続がどの doc を購読しているかは WebSocket の attachment に持つ（DO が休眠しても消えない）
 * - update はその doc の購読者にだけ中継する
 */

import { encodeDocFrame, isValidDocId, MSG_DOC_SYNC, MSG_DOC_UPDATE } from "@edv4h/usketch-sync";
import { createYjsSync } from "./yjs-sync.js";

/** ページ doc の状態を保存するキー。 */
export function pageStateKey(docId: string): string {
	return `yjs_page:${docId}`;
}

/** 1 接続が同時に購読できる doc の数の上限（クライアントの不具合で DO のメモリを使い切らないため）。 */
export const MAX_SUBSCRIPTIONS_PER_SOCKET = 32;

/** WebSocket の attachment に置く値。 */
interface SocketAttachment {
	docs?: string[];
}

/** テストで差し替えられるよう、使う WebSocket の機能だけを型にする。 */
export type PageDocSocket = Pick<
	WebSocket,
	"send" | "serializeAttachment" | "deserializeAttachment"
>;

export interface PageDocsDeps {
	storage: DurableObjectStorage;
	/** 今つながっている全接続。 */
	getSockets: () => PageDocSocket[];
	/** doc に編集が入ったとき（ルート doc の noteBoardEdit に相当。履歴などに使う）。 */
	onEdit?: (docId: string) => void;
}

type YjsSync = ReturnType<typeof createYjsSync>;

// yjs を動的importするためのキャッシュ（yjs-sync.ts と同じ）
let yjsModule: typeof import("yjs") | null = null;
async function getYjs(): Promise<typeof import("yjs")> {
	if (!yjsModule) yjsModule = await import("yjs");
	return yjsModule;
}

function readAttachment(ws: PageDocSocket): SocketAttachment {
	try {
		const value = ws.deserializeAttachment() as unknown;
		return value && typeof value === "object" ? (value as SocketAttachment) : {};
	} catch {
		return {};
	}
}

/** 接続が購読している doc id。 */
export function subscribedDocIds(ws: PageDocSocket): string[] {
	const docs = readAttachment(ws).docs;
	return Array.isArray(docs) ? docs.filter((d): d is string => typeof d === "string") : [];
}

function setSubscribedDocIds(ws: PageDocSocket, docs: string[]): void {
	ws.serializeAttachment({ ...readAttachment(ws), docs } satisfies SocketAttachment);
}

function trySend(ws: PageDocSocket, data: Uint8Array): void {
	try {
		ws.send(data);
	} catch {
		// 閉じたソケットは無視
	}
}

export function createPageDocs(deps: PageDocsDeps) {
	/** 読み込み済みの doc。 */
	const loaded = new Map<string, YjsSync>();

	function subscribersOf(docId: string, except?: PageDocSocket): PageDocSocket[] {
		return deps.getSockets().filter((ws) => ws !== except && subscribedDocIds(ws).includes(docId));
	}

	/** doc を読み込む（済んでいればそれを返す）。読めなければ例外。 */
	async function load(docId: string): Promise<YjsSync> {
		let sync = loaded.get(docId);
		if (!sync) {
			sync = createYjsSync({
				storage: deps.storage,
				stateKey: pageStateKey(docId),
				legacyKey: null,
				onSaved: () => releaseIfIdle(docId),
			});
			loaded.set(docId, sync);
		}
		try {
			await sync.getOrCreateDoc();
		} catch (e) {
			// 読めなかった doc は残さない（空の doc として保存して上書きしないため）
			if (loaded.get(docId) === sync) loaded.delete(docId);
			throw e;
		}
		return sync;
	}

	/** 購読者がおらず、保存も済んでいる doc をメモリから外す。 */
	function releaseIfIdle(docId: string): void {
		const sync = loaded.get(docId);
		if (!sync || sync.isDirty()) return;
		if (subscribersOf(docId).length > 0) return;
		sync.destroyDoc();
		loaded.delete(docId);
	}

	/**
	 * DOC_SUBSCRIBE: 購読を記録し、クライアントに足りない差分とサーバーの state vector を返す。
	 * 不正な id・上限超え・読み込み失敗なら購読しない（false）。
	 */
	async function handleSubscribe(
		ws: PageDocSocket,
		docId: string,
		clientStateVector: Uint8Array | undefined,
	): Promise<boolean> {
		if (!isValidDocId(docId)) return false;
		const current = subscribedDocIds(ws);
		if (!current.includes(docId) && current.length >= MAX_SUBSCRIPTIONS_PER_SOCKET) return false;
		let sync: YjsSync;
		try {
			sync = await load(docId);
		} catch (e) {
			console.error(`[BoardRoom] Failed to load page doc ${docId}:`, e);
			return false;
		}
		const Y = await getYjs();
		const { doc } = await sync.getOrCreateDoc();
		let diff: Uint8Array;
		try {
			diff = clientStateVector
				? Y.encodeStateAsUpdate(doc, clientStateVector)
				: Y.encodeStateAsUpdate(doc);
		} catch {
			// 壊れた state vector は「何も持っていない」とみなす
			diff = Y.encodeStateAsUpdate(doc);
		}
		if (!current.includes(docId)) setSubscribedDocIds(ws, [...current, docId]);
		trySend(ws, encodeDocFrame(MSG_DOC_SYNC, docId, [diff, Y.encodeStateVector(doc)]));
		return true;
	}

	/** DOC_UPDATE: 購読中の doc なら適用・保存予約し、他の購読者へ中継する。 */
	async function handleUpdate(
		ws: PageDocSocket,
		docId: string,
		update: Uint8Array,
	): Promise<boolean> {
		if (!subscribedDocIds(ws).includes(docId)) return false;
		let sync: YjsSync;
		try {
			sync = await load(docId);
		} catch (e) {
			console.error(`[BoardRoom] Failed to load page doc ${docId}:`, e);
			return false;
		}
		const applied = await sync.applyClientUpdate(update);
		if (!applied) return false;
		sync.pushUpdate(update);
		sync.scheduleSave();
		deps.onEdit?.(docId);
		const frame = encodeDocFrame(MSG_DOC_UPDATE, docId, [update]);
		for (const other of subscribersOf(docId, ws)) trySend(other, frame);
		return true;
	}

	/** DOC_UNSUBSCRIBE: 購読をやめ、誰も見ていなければメモリから外す。 */
	function handleUnsubscribe(ws: PageDocSocket, docId: string): void {
		const current = subscribedDocIds(ws);
		if (!current.includes(docId)) return;
		setSubscribedDocIds(
			ws,
			current.filter((d) => d !== docId),
		);
		releaseIfIdle(docId);
	}

	/**
	 * 接続が閉じたとき。その接続の購読を消し（閉じかけのソケットがまだ getSockets に
	 * 含まれていても購読者に数えないため）、誰も見ていない doc をメモリから外す。
	 */
	function handleClose(ws: PageDocSocket): void {
		const docs = subscribedDocIds(ws);
		if (docs.length === 0) return;
		try {
			setSubscribedDocIds(ws, []);
		} catch {
			// 閉じたソケットの attachment は書けないことがある
		}
		for (const docId of docs) releaseIfIdle(docId);
	}

	/** 読み込み済みの doc の id（テスト・監視用）。 */
	function loadedDocIds(): string[] {
		return [...loaded.keys()];
	}

	return {
		handleSubscribe,
		handleUpdate,
		handleUnsubscribe,
		handleClose,
		loadedDocIds,
		load,
	};
}
