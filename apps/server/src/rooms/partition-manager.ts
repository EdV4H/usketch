import { MSG_PARTITION_META } from "@edv4h/usketch-sync";
import { readChunked, writeChunked } from "./chunked-storage.js";
import { compactUpdates, parseLegacyUpdates } from "./update-compaction.js";
import { MAX_SAVE_RETRIES } from "./yjs-sync.js";

/** パーティションの Yjs 状態（バイナリ、分割保存）のキー。 */
export function partitionStateKey(name: string): string {
	return `yjs_partition:${name}`;
}

/** 旧形式（全 update を JSON の数値配列で保存）のキー。読み込み時だけ使う。 */
function legacyPartitionKey(name: string): string {
	return `yjs_updates:${name}`;
}

export interface PartitionMeta {
	partitions: string[];
	activePartition: string;
	shapeCount: Record<string, number>;
}

export interface PartitionManagerDeps {
	storage: DurableObjectStorage;
}

export function createPartitionManager(deps: PartitionManagerDeps) {
	const partitionUpdates = new Map<string, Uint8Array[]>();
	let partitionMeta: PartitionMeta | null = null;
	let loaded = false;
	let loadPromise: Promise<void> | null = null;
	/** パーティションごとの保存デバウンスフラグ */
	const saveScheduled = new Map<string, boolean>();
	/** 最後の保存より後に update が届いたパーティション */
	const dirty = new Set<string>();
	/** 旧形式のキーが残っているパーティション（新形式で保存できたら消す） */
	const legacyPresent = new Set<string>();
	/** 保存済みの状態が読めなかったパーティション（上書きしないよう保存しない） */
	const unreadable = new Set<string>();
	/** パーティションごとの、続けて失敗した保存の回数 */
	const failures = new Map<string, number>();

	/** 現在の四半期のパーティション名を返す */
	function getCurrentPartitionName(): string {
		const now = new Date();
		const q = Math.floor(now.getMonth() / 3) + 1;
		return `shapes:${now.getFullYear()}-Q${q}`;
	}

	/** パーティションメタデータを永続化 */
	async function savePartitionMeta(): Promise<void> {
		if (partitionMeta) {
			try {
				await deps.storage.put("partition_meta", JSON.stringify(partitionMeta));
			} catch (e) {
				console.error("[BoardRoom] Failed to persist partition meta:", e);
			}
		}
	}

	/**
	 * パーティションのバッファを 1 件にまとめる（不要になった履歴は GC される）。
	 * まとめている間に追加された update は失わないよう、対象の件数を先に固定する。
	 */
	async function compactPartition(partitionName: string): Promise<void> {
		const before = partitionUpdates.get(partitionName);
		if (!before) return;
		const count = before.length;
		const merged = await compactUpdates(before.slice(0, count));
		const current = partitionUpdates.get(partitionName) ?? before;
		partitionUpdates.set(partitionName, [...merged, ...current.slice(count)]);
	}

	/** パーティションをまとめて、今の状態を storage に永続化する */
	async function savePartition(partitionName: string): Promise<void> {
		dirty.delete(partitionName);
		if (unreadable.has(partitionName)) return;
		await compactPartition(partitionName);
		const state = partitionUpdates.get(partitionName)?.[0];
		if (!state) return;
		await writeChunked(deps.storage, partitionStateKey(partitionName), state);
		if (legacyPresent.has(partitionName)) {
			await deps.storage.delete(legacyPartitionKey(partitionName));
			legacyPresent.delete(partitionName);
		}
	}

	/** パーティション別 updates を永続化（デバウンス済み） */
	function schedulePartitionSave(partitionName: string): void {
		dirty.add(partitionName);
		if (saveScheduled.get(partitionName)) return;
		saveScheduled.set(partitionName, true);
		setTimeout(() => {
			void (async () => {
				try {
					await savePartition(partitionName);
					failures.delete(partitionName);
				} catch (e) {
					const count = (failures.get(partitionName) ?? 0) + 1;
					failures.set(partitionName, count);
					// 続けて失敗したら、次の update が届くまで再試行しない
					if (count < MAX_SAVE_RETRIES) dirty.add(partitionName);
					console.error("[BoardRoom] Failed to persist partition updates:", e);
				} finally {
					saveScheduled.set(partitionName, false);
					// 保存中に届いた update（または失敗した保存）をもう一度保存する
					if (dirty.has(partitionName)) schedulePartitionSave(partitionName);
				}
			})();
		}, 5000);
	}

	/** パーティションにupdateを追加し、メタデータを更新 */
	async function addToPartition(update: Uint8Array, shapeCount: number): Promise<void> {
		const partName = getCurrentPartitionName();

		if (!partitionMeta) {
			partitionMeta = {
				partitions: [partName],
				activePartition: partName,
				shapeCount: {},
			};
		}

		if (!partitionMeta.partitions.includes(partName)) {
			partitionMeta.partitions.push(partName);
		}
		partitionMeta.activePartition = partName;
		partitionMeta.shapeCount[partName] = shapeCount;

		let updates = partitionUpdates.get(partName);
		if (!updates) {
			updates = [];
			partitionUpdates.set(partName, updates);
		}
		updates.push(update);

		schedulePartitionSave(partName);
		await savePartitionMeta();
	}

	/** パーティションメタデータをクライアントに送信 */
	function sendPartitionMeta(ws: WebSocket): void {
		if (!partitionMeta) return;
		const encoded = new TextEncoder().encode(JSON.stringify(partitionMeta));
		const msg = new Uint8Array(encoded.length + 1);
		msg[0] = MSG_PARTITION_META;
		msg.set(encoded, 1);
		ws.send(msg);
	}

	/** Yjs update をパーティションバッファに追記 + メタ更新 */
	function trackUpdate(payload: Uint8Array): void {
		const partName = getCurrentPartitionName();
		let partUpdates = partitionUpdates.get(partName);
		if (!partUpdates) {
			partUpdates = [];
			partitionUpdates.set(partName, partUpdates);
		}
		partUpdates.push(payload);

		let metaChanged = false;
		if (!partitionMeta) {
			partitionMeta = {
				partitions: [partName],
				activePartition: partName,
				shapeCount: {},
			};
			metaChanged = true;
		} else if (!partitionMeta.partitions.includes(partName)) {
			partitionMeta.partitions.push(partName);
			partitionMeta.activePartition = partName;
			metaChanged = true;
		}
		if (metaChanged) {
			void savePartitionMeta();
		}
		// 古い update は捨てない。件数の抑制は保存時の圧縮で行う。
		schedulePartitionSave(partName);
	}

	/** ストレージからパーティションデータをロード（初回のみ、並行呼び出し安全） */
	async function loadFromStorage(): Promise<void> {
		if (loaded) return;
		if (loadPromise) {
			await loadPromise;
			return;
		}
		loadPromise = (async () => {
			const metaStr = await deps.storage.get<string>("partition_meta");
			if (metaStr) {
				try {
					partitionMeta = JSON.parse(metaStr);
				} catch {
					// 破損データは無視
				}
			}

			if (partitionMeta) {
				for (const name of partitionMeta.partitions) {
					let state: Uint8Array | undefined;
					try {
						state = await readChunked(deps.storage, partitionStateKey(name));
					} catch (e) {
						// パーティションは絞り込み用の履歴なので、読めなくてもボードは開く。
						// 空のパーティションで上書きしないよう、このパーティションは保存しない。
						console.error(`[BoardRoom] Failed to read partition ${name}, skipping:`, e);
						unreadable.add(name);
						continue;
					}
					// 新形式があればそれが最新。旧形式は移行前のボードだけが読む（大きいので）。
					let restored: Uint8Array[];
					if (state) {
						restored = [state];
						// 移行後に消し損ねた旧キーがあっても、次の保存で消す
						legacyPresent.add(name);
					} else {
						const legacy = await deps.storage.get(legacyPartitionKey(name));
						if (legacy !== undefined) legacyPresent.add(name);
						restored = parseLegacyUpdates(legacy);
					}
					// 読み込み中に追加された update を後ろに残す
					const pending = partitionUpdates.get(name) ?? [];
					if (restored.length > 0 || pending.length > 0) {
						partitionUpdates.set(name, [...restored, ...pending]);
					}
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

	/** 特定パーティションの updates を取得 */
	function getPartitionUpdates(name: string): Uint8Array[] | undefined {
		return partitionUpdates.get(name);
	}

	return {
		getCurrentPartitionName,
		savePartitionMeta,
		schedulePartitionSave,
		addToPartition,
		sendPartitionMeta,
		trackUpdate,
		loadFromStorage,
		getPartitionUpdates,
		compactPartition,
		savePartition,
	};
}
