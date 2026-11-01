import { MSG_PARTITION_META } from "@edv4h/usketch-sync";
import { compactUpdates } from "./update-compaction.js";

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
	 * パーティションのバッファが閾値を超えていれば 1 件にマージする（無損失）。
	 * マージ中に追加された update は失わないよう、マージ対象の件数を先に固定する。
	 */
	async function compactPartition(partitionName: string): Promise<void> {
		const before = partitionUpdates.get(partitionName);
		if (!before) return;
		const count = before.length;
		const merged = await compactUpdates(before.slice(0, count));
		const current = partitionUpdates.get(partitionName) ?? before;
		partitionUpdates.set(partitionName, [...merged, ...current.slice(count)]);
	}

	/** パーティション別 updates を永続化（デバウンス済み） */
	function schedulePartitionSave(partitionName: string): void {
		if (saveScheduled.get(partitionName)) return;
		saveScheduled.set(partitionName, true);
		setTimeout(() => {
			void (async () => {
				try {
					await compactPartition(partitionName);
					const updates = partitionUpdates.get(partitionName);
					if (!updates) return;
					const data = updates.map((u) => Array.from(u));
					await deps.storage.put(`yjs_updates:${partitionName}`, JSON.stringify(data));
				} catch (e) {
					console.error("[BoardRoom] Failed to persist partition updates:", e);
				} finally {
					saveScheduled.set(partitionName, false);
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
					const key = `yjs_updates:${name}`;
					const data = await deps.storage.get<string>(key);
					if (data) {
						try {
							const arr = JSON.parse(data) as number[][];
							partitionUpdates.set(
								name,
								arr.map((a) => new Uint8Array(a)),
							);
						} catch {
							// 破損データは無視
						}
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
	};
}
