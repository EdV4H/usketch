/** Yjs updates バッファの管理と永続化 */

import { compactUpdates } from "./update-compaction.js";

// yjs を動的importするためのキャッシュ
let yjsModule: typeof import("yjs") | null = null;
async function getYjs(): Promise<typeof import("yjs")> {
	if (!yjsModule) {
		yjsModule = await import("yjs");
	}
	return yjsModule;
}

export interface YjsSyncDeps {
	storage: DurableObjectStorage;
}

export function createYjsSync(deps: YjsSyncDeps) {
	let updates: Uint8Array[] = [];
	let loaded = false;
	let loadPromise: Promise<void> | null = null;
	let doc: import("yjs").Doc | null = null;
	let saveScheduled = false;

	/** storage から updates を復元（初回のみ、並行呼び出し安全） */
	async function loadUpdates(): Promise<void> {
		if (loaded) return;
		if (loadPromise) {
			await loadPromise;
			return;
		}
		loadPromise = (async () => {
			const stored = await deps.storage.get<string>("yjs_updates");
			if (stored) {
				try {
					const arr = JSON.parse(stored) as number[][];
					for (const a of arr) {
						updates.push(new Uint8Array(a));
					}
				} catch {
					// 破損データは無視
				}
			}
			loaded = true;
		})();
		try {
			await loadPromise;
		} catch (e) {
			loadPromise = null;
			throw e;
		}
	}

	/**
	 * バッファが閾値を超えていれば 1 件にマージする（無損失）。
	 * マージ中に push された update は失わないよう、マージ対象の件数を先に固定する。
	 */
	async function compact(): Promise<void> {
		const count = updates.length;
		const merged = await compactUpdates(updates.slice(0, count));
		updates = [...merged, ...updates.slice(count)];
	}

	/** updates を storage に永続化（デバウンス: 最大5秒ごと） */
	function scheduleSave(): void {
		if (saveScheduled) return;
		saveScheduled = true;
		setTimeout(() => {
			void (async () => {
				try {
					await compact();
					const data = updates.map((u) => Array.from(u));
					await deps.storage.put("yjs_updates", JSON.stringify(data));
				} catch (e) {
					console.error("[BoardRoom] Failed to persist Yjs updates:", e);
				} finally {
					saveScheduled = false;
				}
			})();
		}, 5000);
	}

	/** 蓄積されたupdatesからY.Docを構築/取得 */
	async function getOrCreateDoc(): Promise<{ doc: import("yjs").Doc }> {
		await loadUpdates();
		const Y = await getYjs();
		if (!doc) {
			doc = new Y.Doc();
			for (const update of updates) {
				try {
					Y.applyUpdate(doc, update);
				} catch (e) {
					console.error("[BoardRoom] Corrupt Yjs update during doc init, skipping:", e);
				}
			}
		}
		return { doc };
	}

	/**
	 * update をバッファに追加する。古い update は捨てない（捨てると初期同期で
	 * その update に依存するシェイプが欠ける）。件数の抑制は scheduleSave 時の
	 * 圧縮で行う。
	 */
	function pushUpdate(update: Uint8Array): void {
		updates.push(update);
	}

	/** クライアントからの update を Y.Doc に適用。成功時 true、失敗時 false を返す */
	async function applyClientUpdate(payload: Uint8Array): Promise<boolean> {
		if (doc) {
			try {
				const Y = await getYjs();
				Y.applyUpdate(doc, payload);
			} catch (e) {
				console.error("[BoardRoom] Corrupt Yjs update from client, skipping:", e);
				return false;
			}
		}
		return true;
	}

	/** 蓄積された全 updates を返す（初期同期用） */
	function getUpdates(): Uint8Array[] {
		return updates;
	}

	/** Y.Doc を破棄してメモリを解放 */
	function destroyDoc(): void {
		if (doc) {
			doc.destroy();
			doc = null;
		}
	}

	return {
		loadUpdates,
		scheduleSave,
		getOrCreateDoc,
		pushUpdate,
		applyClientUpdate,
		getUpdates,
		destroyDoc,
		compact,
	};
}
