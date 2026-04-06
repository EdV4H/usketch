/** Yjs updates バッファの管理と永続化 */

/** バッファの最大件数 */
const MAX_UPDATES_BUFFER = 500;

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
	let doc: import("yjs").Doc | null = null;
	let saveScheduled = false;

	/** storage から updates を復元（初回のみ） */
	async function loadUpdates(): Promise<void> {
		if (loaded) return;
		loaded = true;
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
	}

	/** updates を storage に永続化（デバウンス: 最大5秒ごと） */
	function scheduleSave(): void {
		if (saveScheduled) return;
		saveScheduled = true;
		setTimeout(async () => {
			saveScheduled = false;
			const data = updates.slice(-MAX_UPDATES_BUFFER).map((u) => Array.from(u));
			await deps.storage.put("yjs_updates", JSON.stringify(data));
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

	/** update をバッファに追加 */
	function pushUpdate(update: Uint8Array): void {
		updates.push(update);
		if (updates.length > MAX_UPDATES_BUFFER) {
			updates = updates.slice(-MAX_UPDATES_BUFFER);
		}
	}

	/** クライアントからの update を Y.Doc に適用 */
	async function applyClientUpdate(payload: Uint8Array): Promise<void> {
		if (doc) {
			try {
				const Y = await getYjs();
				Y.applyUpdate(doc, payload);
			} catch (e) {
				console.error("[BoardRoom] Corrupt Yjs update from client, skipping:", e);
			}
		}
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
	};
}
