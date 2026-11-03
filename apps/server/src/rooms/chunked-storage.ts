/**
 * Durable Object storage に大きなバイナリを分割して保存する。
 *
 * DO storage は 1 値あたりのサイズに上限があり（超えると SQLITE_TOOBIG）、
 * ボードの Yjs 状態はすぐにそれを超える。値を CHUNK_BYTES ごとに分け、
 * `<key>:meta` に世代番号と長さを置く。チャンクは世代ごとに別キーに書き、
 * 最後に meta を差し替えるので、書き込み途中で落ちても前の世代が読める。
 */

/** 1 チャンクの大きさ。DO storage の値の上限（KV 128 KiB / SQLite 2 MB）に収まる値。 */
export const CHUNK_BYTES = 128 * 1024;

/** storage.get / put / delete に一度に渡せるキーの数。 */
const MAX_KEYS = 128;

interface ChunkMeta {
	gen: number;
	length: number;
	chunks: number;
}

function metaKey(key: string): string {
	return `${key}:meta`;
}

function chunkKeys(key: string, meta: ChunkMeta): string[] {
	return Array.from({ length: meta.chunks }, (_, i) => `${key}:g${meta.gen}:${i}`);
}

function batches<T>(items: readonly T[]): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += MAX_KEYS) out.push(items.slice(i, i + MAX_KEYS));
	return out;
}

function toBytes(value: unknown): Uint8Array | null {
	if (value instanceof Uint8Array) return value;
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	return null;
}

function isMeta(value: unknown): value is ChunkMeta {
	if (!value || typeof value !== "object") return false;
	const m = value as Record<string, unknown>;
	return Number.isInteger(m.gen) && Number.isInteger(m.length) && Number.isInteger(m.chunks);
}

async function readMeta(storage: DurableObjectStorage, key: string): Promise<ChunkMeta | null> {
	const meta = await storage.get(metaKey(key));
	return isMeta(meta) ? meta : null;
}

/** `key` に保存したバイナリを読む。保存されていなければ `undefined`。欠けていれば例外。 */
export async function readChunked(
	storage: DurableObjectStorage,
	key: string,
): Promise<Uint8Array | undefined> {
	const meta = await readMeta(storage, key);
	if (!meta) return undefined;
	const keys = chunkKeys(key, meta);
	const parts = new Map<string, unknown>();
	for (const batch of batches(keys)) {
		const got = await storage.get(batch);
		for (const [k, v] of got) parts.set(k, v);
	}
	const out = new Uint8Array(meta.length);
	let offset = 0;
	for (const k of keys) {
		const part = toBytes(parts.get(k));
		if (!part || offset + part.length > meta.length) {
			throw new Error(`[chunked-storage] chunk ${k} is missing or too long`);
		}
		out.set(part, offset);
		offset += part.length;
	}
	if (offset !== meta.length) {
		throw new Error(`[chunked-storage] ${key} is ${offset} bytes, expected ${meta.length}`);
	}
	return out;
}

/** `data` を `key` に保存する（前の世代は書き終えてから消す）。 */
export async function writeChunked(
	storage: DurableObjectStorage,
	key: string,
	data: Uint8Array,
): Promise<void> {
	const prev = await readMeta(storage, key);
	const meta: ChunkMeta = {
		gen: (prev?.gen ?? 0) + 1,
		length: data.length,
		chunks: Math.ceil(data.length / CHUNK_BYTES),
	};
	const keys = chunkKeys(key, meta);
	for (const batch of batches(keys.map((k, i) => [k, i] as const))) {
		const entries: Record<string, Uint8Array> = {};
		for (const [k, i] of batch) {
			entries[k] = data.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
		}
		await storage.put(entries);
	}
	await storage.put(metaKey(key), meta);
	// 今の世代以外のチャンクを消す（前回の掃除が途中で止まった分も含めて）
	const current = `${key}:g${meta.gen}:`;
	await deleteChunks(storage, key, (k) => !k.startsWith(current));
}

/** `key` のチャンクのうち、`drop` が true を返すものを消す。 */
async function deleteChunks(
	storage: DurableObjectStorage,
	key: string,
	drop: (chunkKey: string) => boolean,
): Promise<void> {
	const listed = await storage.list({ prefix: `${key}:g` });
	const stale = [...listed.keys()].filter(drop);
	for (const batch of batches(stale)) await storage.delete(batch);
}

/** `key` に保存したバイナリを消す。 */
export async function deleteChunked(storage: DurableObjectStorage, key: string): Promise<void> {
	// meta を先に消す（途中で止まっても、読めない値ではなく「ない値」になる）
	await storage.delete(metaKey(key));
	await deleteChunks(storage, key, () => true);
}
