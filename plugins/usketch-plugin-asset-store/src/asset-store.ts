import type * as Y from "yjs";

/**
 * A content-addressed asset (heavy blob) stored once and referenced by shapes
 * via its `id`. Modeled on tldraw's asset records: shapes hold only `assetId`,
 * so duplicating a shape reuses the same asset (same `src`, no data duplication).
 */
export interface AssetRecord {
	id: string;
	/** Asset kind, e.g. "image". */
	type: string;
	/** Resolved source — a data URL (default) or an uploaded URL. */
	src: string;
	meta?: { mimeType?: string; w?: number; h?: number; size?: number };
	createdAt: number;
}

/** Pluggable upload: turn a payload into `{ id, src }`. Default = inline content-hash. */
export type AssetUploader = (
	type: string,
	dataUrl: string,
	meta?: AssetRecord["meta"],
) => Promise<{ id: string; src: string }>;

/** Pluggable resolve: turn a stored record into a usable src (e.g. sign a URL). */
export type AssetResolver = (record: AssetRecord) => string | undefined;

export interface AssetStore {
	get(id: string): AssetRecord | undefined;
	/** Resolve an asset id to a usable `src` (via the resolver), or undefined. */
	resolve(id: string): string | undefined;
	/** Insert/replace an asset record. */
	put(record: AssetRecord): void;
	/**
	 * Store a payload and return its asset id. The default uploader is
	 * content-addressed (`asset:<hash>`) so identical payloads dedupe to one
	 * record. Swap it with {@link AssetStore.setUploader} to upload to a server.
	 */
	upload(type: string, dataUrl: string, meta?: AssetRecord["meta"]): Promise<string>;
	setUploader(fn: AssetUploader): void;
	setResolver(fn: AssetResolver): void;
	subscribe(cb: () => void): () => void;
	destroy(): void;
}

/** Fast, stable content key (FNV-1a → base36). */
export function hashKey(input: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	// Mix length in too, so different-length inputs with colliding rolls diverge.
	return (h >>> 0).toString(36) + input.length.toString(36);
}

export interface CreateAssetStoreOptions {
	/** Y.Map name on the doc. Default "assets". */
	mapName?: string;
}

/**
 * Asset store backed by a Yjs Map on the shared doc, so assets sync to every
 * client and persist (via the existing Durable Object relay) with no server
 * change. This is the "cache in the Map" for heavy, shareable blobs.
 */
export function createAssetStore(doc: Y.Doc, opts: CreateAssetStoreOptions = {}): AssetStore {
	const map = doc.getMap<AssetRecord>(opts.mapName ?? "assets");
	const listeners = new Set<() => void>();

	let uploader: AssetUploader = async (_type, dataUrl) => ({
		id: `asset:${hashKey(dataUrl)}`,
		src: dataUrl,
	});
	let resolver: AssetResolver = (record) => record.src;

	const observer = () => {
		for (const cb of listeners) cb();
	};
	map.observe(observer);

	return {
		get: (id) => map.get(id),
		resolve: (id) => {
			const record = map.get(id);
			return record ? resolver(record) : undefined;
		},
		put: (record) => map.set(record.id, record),
		async upload(type, dataUrl, meta) {
			const { id, src } = await uploader(type, dataUrl, meta);
			// Content-addressed dedup: keep the first record for an id.
			if (!map.has(id)) map.set(id, { id, type, src, meta, createdAt: Date.now() });
			return id;
		},
		setUploader: (fn) => {
			uploader = fn;
		},
		setResolver: (fn) => {
			resolver = fn;
		},
		subscribe: (cb) => {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
		destroy: () => {
			map.unobserve(observer);
			listeners.clear();
		},
	};
}
