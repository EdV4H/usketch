/**
 * サーバーが中継する awareness・ブロードキャストを、受け取る人が見られるページに絞る。
 *
 * クライアントは今いるページを awareness の `page`（{@link PAGE_AWARENESS_FIELD}）と
 * ブロードキャストの `__page`（{@link PAGE_BROADCAST_FIELD}）に書く。見られないページにいる人の
 * カーソルや名前、そのページで起きたことは、ページの中身と同じく見られない人へ送らない。
 */
import { PAGE_AWARENESS_FIELD, PAGE_BROADCAST_FIELD } from "./page-scope.js";

interface AwarenessEntry {
	clientId: number;
	clock: number;
	/** `JSON.stringify(state)`。`"null"` は「いなくなった」。 */
	json: string;
	/** 状態に書かれたページ（無ければ null）。 */
	page: string | null;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function readVarUint(data: Uint8Array, pos: { i: number }): number {
	let num = 0;
	let mult = 1;
	for (;;) {
		if (pos.i >= data.length) throw new Error("Unexpected end of awareness update");
		const byte = data[pos.i++];
		num += (byte & 0x7f) * mult;
		if (byte < 0x80) return num;
		mult *= 128;
		if (mult > Number.MAX_SAFE_INTEGER) throw new Error("Integer out of range");
	}
}

function writeVarUint(out: number[], value: number): void {
	let num = value;
	while (num > 0x7f) {
		out.push(0x80 | (num % 128));
		num = Math.floor(num / 128);
	}
	out.push(num);
}

function decodeAwarenessEntries(update: Uint8Array): AwarenessEntry[] {
	const pos = { i: 0 };
	const count = readVarUint(update, pos);
	const entries: AwarenessEntry[] = [];
	for (let n = 0; n < count; n++) {
		const clientId = readVarUint(update, pos);
		const clock = readVarUint(update, pos);
		const length = readVarUint(update, pos);
		if (pos.i + length > update.length) throw new Error("Unexpected end of awareness update");
		const json = textDecoder.decode(update.subarray(pos.i, pos.i + length));
		pos.i += length;
		let page: string | null = null;
		try {
			const state = JSON.parse(json) as Record<string, unknown> | null;
			const value = state?.[PAGE_AWARENESS_FIELD];
			if (typeof value === "string") page = value;
		} catch {
			// 読めない状態はページ無しとして扱う（y-protocols も読めずに捨てる）
		}
		entries.push({ clientId, clock, json, page });
	}
	return entries;
}

function encodeAwarenessEntries(entries: readonly AwarenessEntry[]): Uint8Array {
	const out: number[] = [];
	writeVarUint(out, entries.length);
	for (const entry of entries) {
		writeVarUint(out, entry.clientId);
		writeVarUint(out, entry.clock);
		const bytes = textEncoder.encode(entry.json);
		writeVarUint(out, bytes.length);
		for (const byte of bytes) out.push(byte);
	}
	return Uint8Array.from(out);
}

/** 読んだ awareness update。受け取る人ごとに {@link ParsedAwarenessUpdate.forViewer} で絞る。 */
export interface ParsedAwarenessUpdate {
	/** 状態に書かれたページ（重複なし）。 */
	readonly pages: readonly string[];
	/**
	 * `canView(pageId)` が false のページにいる人の状態を「いなくなった」（null）に変えた update。
	 * 変える所が無ければ元の update をそのまま返す。
	 */
	forViewer(canView: (pageId: string) => boolean): Uint8Array;
}

/**
 * awareness update（`encodeAwarenessUpdate` の形）を読む。読めなければ null。
 *
 * 見られない人の状態は消すのではなく null にする。受け取る人の手元に前の状態（見られる
 * ページにいたときのもの）が残っていれば、それも消えるように。
 */
export function parseAwarenessUpdate(update: Uint8Array): ParsedAwarenessUpdate | null {
	let entries: AwarenessEntry[];
	try {
		entries = decodeAwarenessEntries(update);
	} catch {
		return null;
	}
	const pages = [...new Set(entries.flatMap((e) => (e.page ? [e.page] : [])))];
	return {
		pages,
		forViewer(canView) {
			const hidden = new Set(pages.filter((page) => !canView(page)));
			if (hidden.size === 0) return update;
			return encodeAwarenessEntries(
				entries.map((e) => (e.page && hidden.has(e.page) ? { ...e, json: "null" } : e)),
			);
		},
	};
}

/** ブロードキャスト（JSON）の送り主のページ。付いていない・読めなければ null。 */
export function broadcastPageOf(payload: Uint8Array): string | null {
	try {
		const msg = JSON.parse(textDecoder.decode(payload)) as Record<string, unknown> | null;
		const page = msg?.[PAGE_BROADCAST_FIELD];
		return typeof page === "string" ? page : null;
	} catch {
		return null;
	}
}
