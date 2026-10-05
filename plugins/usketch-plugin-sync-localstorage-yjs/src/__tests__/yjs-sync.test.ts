import "fake-indexeddb/auto";
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import type { YjsSyncHandle } from "../yjs-sync.js";
import { createYjsSync } from "../yjs-sync.js";

// Minimal BoardStore implementation for testing (avoids depending on @edv4h/usketch-store)
function createTestStore(): BoardStore {
	const shapes = new Map<string, ShapeData>();
	const listeners = new Set<() => void>();
	const mutationListeners = new Set<(event: { type: string; payload?: unknown }) => void>();

	function notify() {
		for (const fn of listeners) fn();
	}
	function notifyMutation(type: string, payload?: unknown) {
		const event = payload !== undefined ? { type, payload } : { type };
		for (const fn of mutationListeners) fn(event);
	}

	return {
		getShapes: () => shapes,
		getShape: (id) => shapes.get(id),
		addShape(shape) {
			shapes.set(shape.id, shape);
			notify();
			notifyMutation("shape:added", { id: shape.id });
		},
		updateShape(id, updates) {
			const existing = shapes.get(id);
			if (!existing) return;
			shapes.set(id, { ...existing, ...updates });
			notify();
			notifyMutation("shape:updated", { id });
		},
		deleteShape(id) {
			if (!shapes.has(id)) return;
			shapes.delete(id);
			notify();
			notifyMutation("shape:removed", { id });
		},
		getSelection: () => new Set<string>(),
		setSelection() {},
		addToSelection() {},
		removeFromSelection() {},
		clearSelection() {},
		getActiveToolId: () => "select",
		setActiveToolId() {},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		setViewport() {},
		panBy() {},
		zoomTo() {},
		getStyleSettings: () => ({
			fill: "#ffffff",
			stroke: "#1e1e1e",
			strokeWidth: 2,
			opacity: 1,
		}),
		setStyleSettings() {},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation(listener) {
			mutationListeners.add(listener);
			return () => mutationListeners.delete(listener);
		},
	};
}

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
	let store: BoardStore;
	let syncHandle: YjsSyncHandle;

	beforeEach(() => {
		store = createTestStore();
	});

	afterEach(() => {
		syncHandle?.destroy();
	});

	it("store.addShape → Y.Map に反映", async () => {
		syncHandle = createYjsSync(store, `test-add-${crypto.randomUUID()}`);
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
		syncHandle = createYjsSync(store, `test-update-${crypto.randomUUID()}`);
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
		syncHandle = createYjsSync(store, `test-delete-${crypto.randomUUID()}`);
		await syncHandle.whenSynced;

		const shape = makeShape({ id: "s3" });
		store.addShape(shape);
		expect(syncHandle.doc.getMap("shapes").has("s3")).toBe(true);

		store.deleteShape("s3");
		expect(syncHandle.doc.getMap("shapes").has("s3")).toBe(false);
	});

	it("Y.Map プリセット → store 復元", async () => {
		const docName = `test-restore-${crypto.randomUUID()}`;

		// Phase 1: populate Y.Doc + persist
		const doc1Store = createTestStore();
		const handle1 = createYjsSync(doc1Store, docName);
		await handle1.whenSynced;

		const shape = makeShape({ id: "s4", x: 42 });
		doc1Store.addShape(shape);

		// Wait a tick for IndexedDB write
		await new Promise((r) => setTimeout(r, 50));
		handle1.destroy();

		// Phase 2: new store should restore from IndexedDB
		const freshStore = createTestStore();
		syncHandle = createYjsSync(freshStore, docName);
		await syncHandle.whenSynced;

		const restored = freshStore.getShape("s4");
		expect(restored).toBeDefined();
		expect(restored?.x).toBe(42);
	});

	it("フィードバックループなし — addShape で Y.Map への書き込みが1回のみ", async () => {
		syncHandle = createYjsSync(store, `test-loop-${crypto.randomUUID()}`);
		await syncHandle.whenSynced;

		const shapesMap = syncHandle.doc.getMap("shapes");
		const setSpy = vi.spyOn(shapesMap, "set");

		const shape = makeShape({ id: "s5" });
		store.addShape(shape);

		expect(setSpy).toHaveBeenCalledTimes(1);
		setSpy.mockRestore();
	});

	it("destroy でクリーンアップ — destroy 後の mutation が Y.Map に届かない", async () => {
		syncHandle = createYjsSync(store, `test-destroy-${crypto.randomUUID()}`);
		await syncHandle.whenSynced;

		const shapesMap = syncHandle.doc.getMap("shapes");

		const shape1 = makeShape({ id: "s6" });
		store.addShape(shape1);
		expect(shapesMap.has("s6")).toBe(true);

		syncHandle.destroy();

		const shape2 = makeShape({ id: "s7" });
		store.addShape(shape2);

		expect(shapesMap.has("s7")).toBe(false);
	});

	it("複数シェイプの追加・削除が正しく同期", async () => {
		syncHandle = createYjsSync(store, `test-multi-${crypto.randomUUID()}`);
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

describe("createYjsSync — options (docName / external doc)", () => {
	let store: BoardStore;
	let syncHandle: YjsSyncHandle;

	beforeEach(() => {
		store = createTestStore();
	});

	afterEach(() => {
		syncHandle?.destroy();
	});

	it("options.docName で IndexedDB doc 名を指定できる", async () => {
		const docName = `test-optname-${crypto.randomUUID()}`;
		syncHandle = createYjsSync(store, { docName });
		await syncHandle.whenSynced;
		store.addShape(makeShape({ id: "od1", x: 11 }));
		await new Promise((r) => setTimeout(r, 50));
		syncHandle.destroy();

		// 同じ docName で復元できる（別 store）
		const fresh = createTestStore();
		syncHandle = createYjsSync(fresh, { docName });
		await syncHandle.whenSynced;
		expect(fresh.getShape("od1")?.x).toBe(11);
	});

	it("docName 省略時は既定 doc 名で永続化される（後方互換）", async () => {
		// 文字列引数（既存呼び出し）と options.docName 省略が同じ doc を指す
		const legacy = createYjsSync(store, "usketch-default");
		await legacy.whenSynced;
		store.addShape(makeShape({ id: "def1", x: 7 }));
		await new Promise((r) => setTimeout(r, 50));
		legacy.destroy();

		const fresh = createTestStore();
		syncHandle = createYjsSync(fresh, {}); // docName 省略
		await syncHandle.whenSynced;
		expect(fresh.getShape("def1")?.x).toBe(7);
	});

	it("外部 doc を渡すとその doc を使い、新規 doc を作らない", async () => {
		const externalDoc = new Y.Doc();
		syncHandle = createYjsSync(store, {
			doc: externalDoc,
			docName: `test-ext-${crypto.randomUUID()}`,
		});
		await syncHandle.whenSynced;
		expect(syncHandle.doc).toBe(externalDoc);

		// store の変更が外部 doc の "shapes" map に反映される
		store.addShape(makeShape({ id: "e1" }));
		expect(externalDoc.getMap("shapes").has("e1")).toBe(true);
		externalDoc.destroy();
	});

	it("外部 doc は destroy() で破棄されない（ホスト所有）", async () => {
		const externalDoc = new Y.Doc();
		let destroyed = false;
		externalDoc.on("destroy", () => {
			destroyed = true;
		});
		syncHandle = createYjsSync(store, {
			doc: externalDoc,
			docName: `test-extkeep-${crypto.randomUUID()}`,
		});
		await syncHandle.whenSynced;
		syncHandle.destroy();
		expect(destroyed).toBe(false);
		// 破棄されていないので引き続き利用できる
		externalDoc.getMap("shapes").set("still", { id: "still" });
		expect(externalDoc.getMap("shapes").has("still")).toBe(true);
		externalDoc.destroy();
	});

	it("内部生成 doc は destroy() で破棄される", async () => {
		const h = createYjsSync(store, { docName: `test-owned-${crypto.randomUUID()}` });
		await h.whenSynced;
		let destroyed = false;
		h.doc.on("destroy", () => {
			destroyed = true;
		});
		h.destroy();
		expect(destroyed).toBe(true);
	});

	it("外部 doc に既存 shape があれば whenSynced で store へ復元される", async () => {
		const externalDoc = new Y.Doc();
		// ネットワーク provider が既に埋めた状態を模擬
		externalDoc.getMap<Record<string, unknown>>("shapes").set("pre1", {
			id: "pre1",
			type: "rect",
			x: 5,
			y: 6,
			width: 10,
			height: 10,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
			zIndex: "a0",
		});
		syncHandle = createYjsSync(store, {
			doc: externalDoc,
			docName: `test-extseed-${crypto.randomUUID()}`,
		});
		await syncHandle.whenSynced;
		expect(store.getShape("pre1")?.x).toBe(5);
		externalDoc.destroy();
	});
});
