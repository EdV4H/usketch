/** Yjs updates バッファの管理と永続化 */

import { readChunked, writeChunked } from "./chunked-storage.js";
import { compactUpdates, parseLegacyUpdates } from "./update-compaction.js";

/** ボードの Yjs 状態（バイナリ、分割保存）のキー。 */
export const STATE_KEY = "yjs_state";
/** 旧形式（全 update を JSON の数値配列で 1 キーに保存）のキー。読み込み時だけ使う。 */
export const LEGACY_UPDATES_KEY = "yjs_updates";
/** 保存に続けて失敗したとき、update を待たずに再試行する回数。 */
export const MAX_SAVE_RETRIES = 3;

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
	/** 状態を分割保存するキー。省略時はボードのルート doc（{@link STATE_KEY}）。 */
	stateKey?: string;
	/**
	 * 旧形式のキー。読み込み時だけ使い、新形式で保存できたら消す。
	 * 省略時はルート doc なら {@link LEGACY_UPDATES_KEY}、それ以外は旧形式なし。
	 */
	legacyKey?: string | null;
	/** 予約していた保存が終わり、未保存の update が残っていないときに呼ぶ。 */
	onSaved?: () => void;
}

export function createYjsSync(deps: YjsSyncDeps) {
	const stateKey = deps.stateKey ?? STATE_KEY;
	const legacyKey =
		deps.legacyKey !== undefined
			? deps.legacyKey
			: stateKey === STATE_KEY
				? LEGACY_UPDATES_KEY
				: null;
	let updates: Uint8Array[] = [];
	let loaded = false;
	let loadPromise: Promise<void> | null = null;
	let doc: import("yjs").Doc | null = null;
	let saveScheduled = false;
	/** 旧形式のキーが残っている（新形式で保存できたら消す） */
	let legacyPresent = false;
	/** 最後の保存より後に update が届いた */
	let dirty = false;
	/** 続けて失敗した保存の回数 */
	let failures = 0;

	/** storage から updates を復元（初回のみ、並行呼び出し安全） */
	async function loadUpdates(): Promise<void> {
		if (loaded) return;
		if (loadPromise) {
			await loadPromise;
			return;
		}
		loadPromise = (async () => {
			// 読めなければ例外のまま返す（空のボードとして始めて上書きしないため）
			const state = await readChunked(deps.storage, stateKey);
			// 新形式があればそれが最新。旧形式は移行前のボードだけが読む（大きいので）。
			let restored: Uint8Array[];
			if (state) {
				restored = [state];
				// 移行後に消し損ねた旧キーがあっても、次の保存で消す
				legacyPresent = true;
			} else if (legacyKey) {
				const legacy = await deps.storage.get(legacyKey);
				legacyPresent = legacy !== undefined;
				restored = parseLegacyUpdates(legacy);
			} else {
				restored = [];
			}
			// 読み込み中に push された update を後ろに残す
			updates = [...restored, ...updates];
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
	 * バッファを今の状態 1 件にまとめる（不要になった履歴は GC される）。
	 * まとめている間に push された update は失わないよう、対象の件数を先に固定する。
	 */
	async function compact(): Promise<void> {
		const count = updates.length;
		const merged = await compactUpdates(updates.slice(0, count));
		updates = [...merged, ...updates.slice(count)];
	}

	/** バッファをまとめて、今の状態を storage に永続化する */
	async function save(): Promise<void> {
		dirty = false;
		await compact();
		const [state] = updates;
		if (!state) return;
		await writeChunked(deps.storage, stateKey, state);
		if (legacyPresent && legacyKey) {
			await deps.storage.delete(legacyKey);
			legacyPresent = false;
		}
	}

	/** updates を storage に永続化（デバウンス: 最大5秒ごと） */
	function scheduleSave(): void {
		if (saveScheduled) return;
		saveScheduled = true;
		setTimeout(() => {
			void (async () => {
				try {
					await save();
					failures = 0;
				} catch (e) {
					failures++;
					// 続けて失敗したら、次の update が届くまで再試行しない
					if (failures < MAX_SAVE_RETRIES) dirty = true;
					console.error("[BoardRoom] Failed to persist Yjs updates:", e);
				} finally {
					saveScheduled = false;
					// 保存中に届いた update（または失敗した保存）をもう一度保存する
					if (dirty) scheduleSave();
					else if (failures === 0) deps.onSaved?.();
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
		dirty = true;
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

	/** 保存できていない update があるか（保存の予約中・直前の保存の失敗を含む）。 */
	function isDirty(): boolean {
		return dirty || saveScheduled || failures > 0;
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
		save,
		isDirty,
	};
}
