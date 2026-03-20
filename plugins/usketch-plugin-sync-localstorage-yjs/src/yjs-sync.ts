import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { SyncStatusTracker } from "./sync-status-tracker.js";
import { createWsProvider, type WsProviderHandle } from "./ws-provider.js";

export interface YjsSyncHandle {
	doc: Y.Doc;
	status: SyncStatusTracker;
	whenSynced: Promise<void>;
	/** WebSocket接続を開始してリアルタイム同期を有効化 */
	connectWebSocket(url: string): WsProviderHandle | null;
	destroy(): void;
}

function toPlainObject(shape: ShapeData): Record<string, unknown> {
	return JSON.parse(JSON.stringify(shape));
}

export function createYjsSync(store: BoardStore, docName: string): YjsSyncHandle {
	const doc = new Y.Doc();
	const idbProvider = new IndexeddbPersistence(docName, doc);
	const shapesMap = doc.getMap<Record<string, unknown>>("shapes");
	const status = new SyncStatusTracker();

	let isSyncing = false;
	let destroyed = false;

	// Store → Yjs: listen to store mutations and push to Y.Map
	const unsubMutation = store.onMutation((event) => {
		if (isSyncing || destroyed) return;

		const payload = event.payload as { id: string } | undefined;
		if (!payload?.id) return;

		isSyncing = true;
		try {
			switch (event.type) {
				case "shape:added":
				case "shape:updated": {
					const shape = store.getShape(payload.id);
					if (shape) {
						shapesMap.set(payload.id, toPlainObject(shape));
					}
					break;
				}
				case "shape:removed": {
					shapesMap.delete(payload.id);
					break;
				}
			}
		} finally {
			isSyncing = false;
		}

		status.update({
			state: "synced",
			shapeCount: shapesMap.size,
			lastSyncedAt: Date.now(),
		});
	});

	// Yjs → Store: observe Y.Map changes (for future remote sync + initial load reconciliation)
	const observer = (events: Y.YMapEvent<Record<string, unknown>>, _txn: Y.Transaction) => {
		if (isSyncing || destroyed) return;

		isSyncing = true;
		try {
			for (const [key, change] of events.changes.keys) {
				switch (change.action) {
					case "add":
					case "update": {
						const value = shapesMap.get(key);
						if (value) {
							const shape = value as unknown as ShapeData;
							const existing = store.getShape(key);
							if (existing) {
								store.updateShape(key, shape);
							} else {
								store.addShape(shape);
							}
						}
						break;
					}
					case "delete": {
						if (store.getShape(key)) {
							store.deleteShape(key);
						}
						break;
					}
				}
			}
		} finally {
			isSyncing = false;
		}
	};

	shapesMap.observe(observer);

	// Wait for IndexedDB sync, then restore shapes to store
	const whenSynced = new Promise<void>((resolve) => {
		idbProvider.once("synced", () => {
			if (destroyed) {
				resolve();
				return;
			}

			isSyncing = true;
			try {
				for (const [id, value] of shapesMap.entries()) {
					const shape = value as unknown as ShapeData;
					if (!store.getShape(id)) {
						store.addShape(shape);
					}
				}
			} finally {
				isSyncing = false;
			}

			status.update({
				state: "synced",
				shapeCount: shapesMap.size,
				lastSyncedAt: Date.now(),
			});

			resolve();
		});
	});

	let wsProvider: WsProviderHandle | null = null;

	function connectWebSocket(url: string): WsProviderHandle | null {
		if (destroyed || wsProvider) return wsProvider;
		wsProvider = createWsProvider({ url, doc });
		return wsProvider;
	}

	function destroy() {
		if (destroyed) return;
		destroyed = true;
		wsProvider?.destroy();
		unsubMutation();
		shapesMap.unobserve(observer);
		doc.destroy();
		idbProvider.destroy();
	}

	return { doc, status, whenSynced, connectWebSocket, destroy };
}
