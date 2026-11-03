/** Yjs スナップショットの CRUD + 自動スナップショットスケジューリング */

import { deleteChunked, readChunked, writeChunked } from "./chunked-storage.js";

/**
 * スナップショット時点のボード状態（`encodeStateAsUpdate`）のキー。
 * 以前は `Y.snapshot`（状態ベクトルと削除集合だけ）を `snapshot:<ts>` に保存し、
 * 読むときに今の doc から復元していたが、それには doc が削除済みの中身を
 * 全部持っている必要がある（gc: false）。サーバーの doc も保存も GC するので、
 * スナップショットは時点の状態そのものを持つ。
 */
function snapshotStateKey(ts: number): string {
	return `snapshot_state:${ts}`;
}

/** 旧形式のスナップショットのキー。 */
function legacySnapshotKey(ts: number): string {
	return `snapshot:${ts}`;
}

function shapesOf(doc: import("yjs").Doc): Record<string, unknown>[] {
	return [...doc.getMap<Record<string, unknown>>("shapes").values()];
}

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
			const ts = Date.now();

			await writeChunked(deps.storage, snapshotStateKey(ts), Y.encodeStateAsUpdate(doc));

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
					await deleteChunked(deps.storage, snapshotStateKey(r.timestamp));
					await deps.storage.delete(legacySnapshotKey(r.timestamp));
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

			const state = await readChunked(deps.storage, snapshotStateKey(ts));
			if (!state) {
				// 旧形式（Y.snapshot）は gc: false の doc がないと復元できず、サーバーの
				// doc は GC 有効なので以前から読めなかった。
				const legacy = await deps.storage.get(legacySnapshotKey(ts));
				return new Response(
					JSON.stringify({
						error: legacy
							? "Snapshot is in an old format and can't be restored"
							: "Snapshot not found",
					}),
					{ status: legacy ? 410 : 404, headers: { "Content-Type": "application/json" } },
				);
			}

			const Y = await getYjs();
			const snapshotDoc = new Y.Doc();
			Y.applyUpdate(snapshotDoc, state);
			const shapes = shapesOf(snapshotDoc);
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
