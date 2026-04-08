import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { SyncStatusTracker } from "./sync-status-tracker.js";

export interface YjsSyncHandle {
	doc: Y.Doc;
	status: SyncStatusTracker;
	whenSynced: Promise<void>;
	/** Load an additional partition's Y.Map and sync its shapes to the store */
	loadPartition(partitionName: string): void;
	/** Unload a partition's shapes from the store (remove observer, delete shapes from store) */
	unloadPartition(partitionName: string): void;
	/** Get the list of currently loaded partition names */
	getLoadedPartitions(): string[];
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

	// Yjs → Store: observe Y.Map changes (for remote sync + initial load reconciliation)
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
				const idsNeedingZIndex: string[] = [];
				for (const [id, value] of shapesMap.entries()) {
					const shape = value as unknown as ShapeData;
					if (!store.getShape(id)) {
						store.addShape(shape);
					}
					// Track legacy shapes that were persisted before z-order was introduced.
					if (typeof shape.zIndex !== "string") {
						idsNeedingZIndex.push(id);
					}
				}

				// Backfill zIndex for legacy shapes: addShape auto-assigned one, so push
				// the new value back to Y.Map so we don't re-randomize on every load.
				if (idsNeedingZIndex.length > 0) {
					doc.transact(() => {
						for (const id of idsNeedingZIndex) {
							const current = store.getShape(id);
							if (current) shapesMap.set(id, toPlainObject(current));
						}
					});
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

	// ── Partition support ──
	// Track additional Y.Maps and their observers for on-demand partition loading
	const loadedPartitions = new Map<
		string,
		{
			map: Y.Map<Record<string, unknown>>;
			unobserve: () => void;
			shapeIds: Set<string>;
		}
	>();

	function loadPartition(partitionName: string) {
		if (destroyed || loadedPartitions.has(partitionName)) return;

		const partMap = doc.getMap<Record<string, unknown>>(partitionName);
		const partShapeIds = new Set<string>();

		// Sync existing entries to store
		isSyncing = true;
		try {
			for (const [id, value] of partMap.entries()) {
				const shape = value as unknown as ShapeData;
				partShapeIds.add(id);
				if (!store.getShape(id)) {
					store.addShape(shape);
				}
			}
		} finally {
			isSyncing = false;
		}

		// Observe future changes
		const partObserver = (events: Y.YMapEvent<Record<string, unknown>>, _txn: Y.Transaction) => {
			if (isSyncing || destroyed) return;
			isSyncing = true;
			try {
				for (const [key, change] of events.changes.keys) {
					switch (change.action) {
						case "add":
						case "update": {
							const value = partMap.get(key);
							if (value) {
								const shape = value as unknown as ShapeData;
								partShapeIds.add(key);
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
							partShapeIds.delete(key);
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

		partMap.observe(partObserver);

		loadedPartitions.set(partitionName, {
			map: partMap,
			unobserve: () => partMap.unobserve(partObserver),
			shapeIds: partShapeIds,
		});
	}

	function unloadPartition(partitionName: string) {
		const entry = loadedPartitions.get(partitionName);
		if (!entry) return;

		entry.unobserve();

		// Remove shapes that belong to this partition from the store
		isSyncing = true;
		try {
			for (const id of entry.shapeIds) {
				if (store.getShape(id)) {
					store.deleteShape(id);
				}
			}
		} finally {
			isSyncing = false;
		}

		loadedPartitions.delete(partitionName);
	}

	function getLoadedPartitions(): string[] {
		return Array.from(loadedPartitions.keys());
	}

	function destroy() {
		if (destroyed) return;
		destroyed = true;
		unsubMutation();
		shapesMap.unobserve(observer);
		// Clean up partition observers
		for (const [, entry] of loadedPartitions) {
			entry.unobserve();
		}
		loadedPartitions.clear();
		doc.destroy();
		idbProvider.destroy();
	}

	return { doc, status, whenSynced, loadPartition, unloadPartition, getLoadedPartitions, destroy };
}
