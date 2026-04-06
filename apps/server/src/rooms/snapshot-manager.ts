/** Yjs スナップショットの CRUD + 自動スナップショットスケジューリング */

type GetOrCreateDoc = () => Promise<{ doc: import("yjs").Doc }>;

// yjs を動的importするためのキャッシュ
let yjsModule: typeof import("yjs") | null = null;
async function getYjs(): Promise<typeof import("yjs")> {
	if (!yjsModule) {
		yjsModule = await import("yjs");
	}
	return yjsModule;
}

export interface SnapshotManagerDeps {
	storage: DurableObjectStorage;
	getOrCreateDoc: GetOrCreateDoc;
	getWebSockets: () => WebSocket[];
}

export function createSnapshotManager(deps: SnapshotManagerDeps) {
	let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

	/** スナップショットを作成して保存 */
	async function handleCreateSnapshot(): Promise<Response> {
		try {
			const Y = await getYjs();
			const { doc } = await deps.getOrCreateDoc();
			const snapshot = Y.snapshot(doc);
			const encoded = Y.encodeSnapshot(snapshot);
			const ts = Date.now();

			await deps.storage.put(`snapshot:${ts}`, Array.from(encoded));

			const indexStr = await deps.storage.get<string>("snapshots:index");
			const index: { timestamp: number; shapeCount: number }[] = indexStr
				? JSON.parse(indexStr)
				: [];
			const shapesMap = doc.getMap<Record<string, unknown>>("shapes");
			index.push({ timestamp: ts, shapeCount: shapesMap.size });

			// Keep max 100 snapshots
			if (index.length > 100) {
				const removed = index.splice(0, index.length - 100);
				for (const r of removed) {
					await deps.storage.delete(`snapshot:${r.timestamp}`);
				}
			}

			await deps.storage.put("snapshots:index", JSON.stringify(index));
			return new Response(JSON.stringify({ timestamp: ts, shapeCount: shapesMap.size }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			return new Response(
				JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	}

	/** スナップショット一覧を返す */
	async function handleListSnapshots(): Promise<Response> {
		const indexStr = await deps.storage.get<string>("snapshots:index");
		const index: { timestamp: number; shapeCount: number }[] = indexStr ? JSON.parse(indexStr) : [];
		return new Response(JSON.stringify({ snapshots: index }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	}

	/** 特定のスナップショットからシェイプデータを返す */
	async function handleGetSnapshot(timestampStr: string): Promise<Response> {
		try {
			const ts = Number(timestampStr);
			if (Number.isNaN(ts)) {
				return new Response(JSON.stringify({ error: "Invalid timestamp" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			const stored = await deps.storage.get<number[]>(`snapshot:${ts}`);
			if (!stored) {
				return new Response(JSON.stringify({ error: "Snapshot not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}

			const Y = await getYjs();
			const { doc } = await deps.getOrCreateDoc();
			const snapshot = Y.decodeSnapshot(new Uint8Array(stored));
			const snapshotDoc = Y.createDocFromSnapshot(doc, snapshot);
			const shapesMap = snapshotDoc.getMap<Record<string, unknown>>("shapes");

			const shapes: Record<string, unknown>[] = [];
			for (const [, value] of shapesMap) {
				shapes.push(value);
			}

			snapshotDoc.destroy();

			return new Response(JSON.stringify({ timestamp: ts, shapes }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (err) {
			return new Response(
				JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
				{ status: 500, headers: { "Content-Type": "application/json" } },
			);
		}
	}

	/** 自動スナップショット — アクティブ接続がある間、1時間ごとに実行 */
	function scheduleAutoSnapshot(): void {
		if (snapshotTimer) return;
		const SNAPSHOT_INTERVAL = 60 * 60 * 1000; // 1 hour
		snapshotTimer = setTimeout(async () => {
			snapshotTimer = null;
			if (deps.getWebSockets().length > 0) {
				try {
					await handleCreateSnapshot();
				} catch {
					// スナップショット作成失敗は無視
				}
				scheduleAutoSnapshot();
			}
		}, SNAPSHOT_INTERVAL);
	}

	return {
		handleCreateSnapshot,
		handleListSnapshots,
		handleGetSnapshot,
		scheduleAutoSnapshot,
	};
}
