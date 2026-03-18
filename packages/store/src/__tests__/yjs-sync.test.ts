import "fake-indexeddb/auto";
import type { ShapeData } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBoardStore } from "../board-store.js";
import type { YjsSyncHandle } from "../yjs-sync.js";
import { createYjsSync } from "../yjs-sync.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: `shape-${Math.random().toString(36).slice(2, 8)}`,
		type: "rect",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		...overrides,
	};
}

describe("createYjsSync", () => {
	let store: ReturnType<typeof createBoardStore>;
	let syncHandle: YjsSyncHandle;

	beforeEach(() => {
		store = createBoardStore();
	});

	afterEach(() => {
		syncHandle?.destroy();
	});

	it("store.addShape → Y.Map に反映", async () => {
		syncHandle = createYjsSync({ store, docName: `test-add-${Date.now()}` });
		await syncHandle.whenSynced;

		const shape = makeShape({ id: "s1" });
		store.addShape(shape);

		const shapesMap = syncHandle.doc.getMap("shapes");
		const stored = shapesMap.get("s1") as Record<string, unknown>;
		expect(stored).toBeDefined();
		expect(stored.id).toBe("s1");
		expect(stored.type).toBe("rect");
		expect(stored.width).toBe(100);
	});

	it("store.updateShape → Y.Map 更新", async () => {
		syncHandle = createYjsSync({ store, docName: `test-update-${Date.now()}` });
		await syncHandle.whenSynced;

		const shape = makeShape({ id: "s2" });
		store.addShape(shape);
		store.updateShape("s2", { x: 50, y: 75 });

		const shapesMap = syncHandle.doc.getMap("shapes");
		const stored = shapesMap.get("s2") as Record<string, unknown>;
		expect(stored.x).toBe(50);
		expect(stored.y).toBe(75);
	});

	it("store.deleteShape → Y.Map 削除", async () => {
		syncHandle = createYjsSync({ store, docName: `test-delete-${Date.now()}` });
		await syncHandle.whenSynced;

		const shape = makeShape({ id: "s3" });
		store.addShape(shape);
		expect(syncHandle.doc.getMap("shapes").has("s3")).toBe(true);

		store.deleteShape("s3");
		expect(syncHandle.doc.getMap("shapes").has("s3")).toBe(false);
	});

	it("Y.Map プリセット → store 復元", async () => {
		const docName = `test-restore-${Date.now()}`;

		// Phase 1: populate Y.Doc + persist
		const doc1Store = createBoardStore();
		const handle1 = createYjsSync({ store: doc1Store, docName });
		await handle1.whenSynced;

		const shape = makeShape({ id: "s4", x: 42 });
		doc1Store.addShape(shape);

		// Wait a tick for IndexedDB write
		await new Promise((r) => setTimeout(r, 50));
		handle1.destroy();

		// Phase 2: new store should restore from IndexedDB
		const freshStore = createBoardStore();
		syncHandle = createYjsSync({ store: freshStore, docName });
		await syncHandle.whenSynced;

		const restored = freshStore.getShape("s4");
		expect(restored).toBeDefined();
		expect(restored?.x).toBe(42);
	});

	it("フィードバックループなし — addShape で Y.Map への書き込みが1回のみ", async () => {
		syncHandle = createYjsSync({
			store,
			docName: `test-loop-${Date.now()}`,
		});
		await syncHandle.whenSynced;

		const shapesMap = syncHandle.doc.getMap("shapes");
		const setSpy = vi.spyOn(shapesMap, "set");

		const shape = makeShape({ id: "s5" });
		store.addShape(shape);

		expect(setSpy).toHaveBeenCalledTimes(1);
		setSpy.mockRestore();
	});

	it("destroy でクリーンアップ — destroy 後の mutation が Y.Map に届かない", async () => {
		syncHandle = createYjsSync({
			store,
			docName: `test-destroy-${Date.now()}`,
		});
		await syncHandle.whenSynced;

		const shapesMap = syncHandle.doc.getMap("shapes");

		// Add a shape before destroy
		const shape1 = makeShape({ id: "s6" });
		store.addShape(shape1);
		expect(shapesMap.has("s6")).toBe(true);

		// Destroy sync
		syncHandle.destroy();

		// Add another shape after destroy
		const shape2 = makeShape({ id: "s7" });
		store.addShape(shape2);

		// s7 should NOT be in the Y.Map
		expect(shapesMap.has("s7")).toBe(false);
	});

	it("複数シェイプの追加・削除が正しく同期", async () => {
		syncHandle = createYjsSync({ store, docName: `test-multi-${Date.now()}` });
		await syncHandle.whenSynced;

		const shapesMap = syncHandle.doc.getMap("shapes");

		store.addShape(makeShape({ id: "a1" }));
		store.addShape(makeShape({ id: "a2" }));
		store.addShape(makeShape({ id: "a3" }));

		expect(shapesMap.size).toBe(3);

		store.deleteShape("a2");
		expect(shapesMap.size).toBe(2);
		expect(shapesMap.has("a2")).toBe(false);
	});
});
