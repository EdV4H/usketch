/**
 * ページ doc（ルート doc とは別に同期する Y.Doc）の購読。
 * board-room の DOC_SUBSCRIBE / DOC_SYNC / DOC_UPDATE / DOC_UNSUBSCRIBE に合わせる。
 *
 * - 開いたページだけを購読し、最初の DOC_SYNC を待ってから使う
 * - 開いたページは {@link MAX_OPEN_PAGES} 枚まで持ち、超えたら古いものから購読をやめる
 * - 再接続したら持っているページを購読し直す（state vector を送るので、切れている間の
 *   編集もサーバーに足りない分として送り返せる）
 */

import {
	decodeDocFrame,
	encodeDocFrame,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_SYNC,
	MSG_DOC_UNSUBSCRIBE,
	MSG_DOC_UPDATE,
	pageDocGuid,
} from "@edv4h/usketch-sync";
import * as Y from "yjs";

/** 同時に持つページ doc の数（サーバーは 1 接続 32 件まで）。 */
export const MAX_OPEN_PAGES = 8;
/** 購読してから DOC_SYNC を待つ時間。 */
export const PAGE_SYNC_TIMEOUT_MS = 5_000;

export interface PageSubscriptionsOptions {
	/** フレームを送る。つながっていなければ false。 */
	send: (frame: Uint8Array) => boolean;
	maxOpen?: number;
	syncTimeoutMs?: number;
}

interface Entry {
	doc: Y.Doc;
	synced: boolean;
	waiters: Array<{ resolve: () => void; reject: (e: Error) => void }>;
	onUpdate: (update: Uint8Array, origin: unknown) => void;
}

/** 中身の無い update（構造体 0 件・削除 0 件）か。 */
function isEmptyUpdate(update: Uint8Array): boolean {
	return update.length === 2 && update[0] === 0 && update[1] === 0;
}

export class PageSubscriptions {
	/** 挿入順 = 使った順（最後が一番新しい）。 */
	private readonly entries = new Map<string, Entry>();
	private readonly maxOpen: number;
	private readonly syncTimeoutMs: number;

	constructor(private readonly options: PageSubscriptionsOptions) {
		this.maxOpen = options.maxOpen ?? MAX_OPEN_PAGES;
		this.syncTimeoutMs = options.syncTimeoutMs ?? PAGE_SYNC_TIMEOUT_MS;
	}

	/** ページ doc を開き、サーバーと同期できたら返す。同期できなければ例外。 */
	async open(pageId: string): Promise<Y.Doc> {
		let entry = this.entries.get(pageId);
		if (entry) {
			// 使った順を更新
			this.entries.delete(pageId);
			this.entries.set(pageId, entry);
		} else {
			const doc = new Y.Doc({ guid: pageDocGuid(pageId) });
			const onUpdate = (update: Uint8Array, origin: unknown) => {
				if (origin === "remote") return;
				this.options.send(encodeDocFrame(MSG_DOC_UPDATE, pageId, [update]));
			};
			doc.on("update", onUpdate);
			entry = { doc, synced: false, waiters: [], onUpdate };
			this.entries.set(pageId, entry);
			this.evict();
			this.subscribe(pageId, entry);
		}
		if (!entry.synced) await this.waitSynced(pageId, entry);
		return entry.doc;
	}

	/** DOC_SYNC / DOC_UPDATE を受け取る。ページ doc 宛てのフレームなら true。 */
	handleFrame(data: Uint8Array): boolean {
		const type = data[0];
		if (type !== MSG_DOC_SYNC && type !== MSG_DOC_UPDATE) return false;
		const frame = decodeDocFrame(data);
		const entry = frame && this.entries.get(frame.docId);
		if (!frame || !entry) return true;
		const [update, serverStateVector] = frame.parts;
		try {
			if (update && update.length > 0) Y.applyUpdate(entry.doc, update, "remote");
		} catch (e) {
			console.error(`[mcp] Corrupt page doc update for ${frame.docId}, skipping:`, e);
		}
		if (type === MSG_DOC_SYNC) {
			// サーバーに足りない分（切れている間の編集など）を送り返す
			if (serverStateVector) {
				const missing = Y.encodeStateAsUpdate(entry.doc, serverStateVector);
				if (!isEmptyUpdate(missing)) {
					this.options.send(encodeDocFrame(MSG_DOC_UPDATE, frame.docId, [missing]));
				}
			}
			entry.synced = true;
			for (const w of entry.waiters.splice(0)) w.resolve();
		}
		return true;
	}

	/** つながり直したとき。持っているページを購読し直す。 */
	resubscribeAll(): void {
		for (const [pageId, entry] of this.entries) this.subscribe(pageId, entry);
	}

	/** 開いているページ（古い順）。 */
	openPageIds(): string[] {
		return [...this.entries.keys()];
	}

	/** ページ doc を閉じる（サーバーへの購読もやめる）。 */
	close(pageId: string): void {
		const entry = this.entries.get(pageId);
		if (!entry) return;
		this.entries.delete(pageId);
		entry.doc.off("update", entry.onUpdate);
		this.options.send(encodeDocFrame(MSG_DOC_UNSUBSCRIBE, pageId));
		for (const w of entry.waiters.splice(0)) w.reject(new Error(`Page closed: ${pageId}`));
		entry.doc.destroy();
	}

	destroy(): void {
		for (const pageId of [...this.entries.keys()]) this.close(pageId);
	}

	private subscribe(pageId: string, entry: Entry): void {
		this.options.send(encodeDocFrame(MSG_DOC_SUBSCRIBE, pageId, [Y.encodeStateVector(entry.doc)]));
	}

	private evict(): void {
		while (this.entries.size > this.maxOpen) {
			const oldest = this.entries.keys().next().value;
			if (oldest === undefined) return;
			this.close(oldest);
		}
	}

	private waitSynced(pageId: string, entry: Entry): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				const i = entry.waiters.indexOf(waiter);
				if (i >= 0) entry.waiters.splice(i, 1);
				// 同期できなかったページは持たない（次に開くときに購読し直す）
				if (!entry.synced && this.entries.get(pageId) === entry) this.close(pageId);
				reject(new Error(`Timed out loading page: ${pageId}`));
			}, this.syncTimeoutMs);
			const waiter = {
				resolve: () => {
					clearTimeout(timer);
					resolve();
				},
				reject: (e: Error) => {
					clearTimeout(timer);
					reject(e);
				},
			};
			entry.waiters.push(waiter);
		});
	}
}
