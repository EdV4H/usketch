import { MSG_PARTITION_META } from "@edv4h/usketch-sync";

/** バッファの最大件数 */
const MAX_UPDATES_BUFFER = 500;

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

	/** 現在の四半期のパーティション名を返す */
	function getCurrentPartitionName(): string {
		const now = new Date();
		const q = Math.floor(now.getMonth() / 3) + 1;
		return `shapes:${now.getFullYear()}-Q${q}`;
	}

	/** パーティションメタデータを永続化 */
	async function savePartitionMeta(): Promise<void> {
		if (partitionMeta) {
			await deps.storage.put("partition_meta", JSON.stringify(partitionMeta));
		}
	}

	/** パーティション別 updates を永続化 */
	function schedulePartitionSave(partitionName: string): void {
		setTimeout(async () => {
			const updates = partitionUpdates.get(partitionName);
			if (!updates) return;
			const data = updates.slice(-MAX_UPDATES_BUFFER).map((u) => Array.from(u));
			await deps.storage.put(`yjs_updates:${partitionName}`, JSON.stringify(data));
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

		if (!partitionMeta) {
			partitionMeta = {
				partitions: [partName],
				activePartition: partName,
				shapeCount: {},
			};
		} else if (!partitionMeta.partitions.includes(partName)) {
			partitionMeta.partitions.push(partName);
			partitionMeta.activePartition = partName;
		}
		schedulePartitionSave(partName);

		// バッファサイズ制限
		if (partUpdates.length > MAX_UPDATES_BUFFER) {
			partitionUpdates.set(partName, partUpdates.slice(-MAX_UPDATES_BUFFER));
		}
	}

	/** ストレージからパーティションデータをロード */
	async function loadFromStorage(): Promise<void> {
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
	};
}
