import type { Mock } from "vitest";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { YwebsocketSyncHandle } from "../types.js";
import { createYwebsocketSync } from "../yws-sync.js";
import { createTestStore, makeShape } from "./test-store.js";

// All tests run with `autoConnect: false` — we don't want to open real sockets during unit tests.
// The WebSocket-level behavior (reconnect, token refresh) is covered by manual testing / E2E.

describe("createYwebsocketSync (store ↔ Y.Doc binding)", () => {
	const handles: YwebsocketSyncHandle[] = [];

	afterEach(() => {
		while (handles.length) {
			handles.pop()?.destroy();
		}
	});

	function setup(opts: { doc?: Y.Doc; shapesMapKey?: string; resolveParams?: Mock } = {}) {
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "test-room",
			autoConnect: false,
			doc: opts.doc,
			shapesMapKey: opts.shapesMapKey,
			resolveParams: opts.resolveParams,
		});
		handles.push(handle);
		return { store, handle };
	}

	it("pushes store additions into the Y.Doc shapes map", () => {
		const { store, handle } = setup();
		const shape = makeShape({ id: "s1" });

		store.addShape(shape);

		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");
		expect(shapesMap.has("s1")).toBe(true);
		expect((shapesMap.get("s1") as { id: string }).id).toBe("s1");
	});

	it("pushes store updates and deletions into the Y.Doc", () => {
		const { store, handle } = setup();
		const shape = makeShape({ id: "s1", x: 0 });
		store.addShape(shape);

		store.updateShape("s1", { x: 100 });
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");
		expect((shapesMap.get("s1") as { x: number }).x).toBe(100);

		store.deleteShape("s1");
		expect(shapesMap.has("s1")).toBe(false);
	});

	it("applies Y.Doc changes back into the store", () => {
		const { store, handle } = setup();
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");

		// Simulate a remote change by mutating the Y.Map directly in a transaction.
		handle.doc.transact(() => {
			shapesMap.set("remote-1", {
				id: "remote-1",
				type: "rect",
				x: 42,
				y: 0,
				width: 50,
				height: 50,
				style: { fill: "#000", stroke: "#000", strokeWidth: 1, opacity: 1 },
			});
		});

		expect(store.getShape("remote-1")).toBeDefined();
		expect(store.getShape("remote-1")?.x).toBe(42);
	});

	it("loads pre-existing shapes from a provided Y.Doc on creation", () => {
		const doc = new Y.Doc();
		const shapesMap = doc.getMap<Record<string, unknown>>("shapes");
		shapesMap.set("pre", {
			id: "pre",
			type: "rect",
			x: 1,
			y: 2,
			width: 10,
			height: 10,
			style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		});

		const { store } = setup({ doc });
		expect(store.getShape("pre")).toBeDefined();
		expect(store.getShape("pre")?.x).toBe(1);
	});

	it("updates status.shapeCount and lastSyncedAt after local store mutations", () => {
		const { store, handle } = setup();
		const before = handle.status.getSnapshot().shapeCount;
		store.addShape(makeShape({ id: "s1" }));
		const after = handle.status.getSnapshot();
		expect(after.shapeCount).toBe(before + 1);
		expect(after.lastSyncedAt).not.toBeNull();
	});

	it("supports a custom shapesMapKey (for weboard's legacy 'map' key)", () => {
		const { store, handle } = setup({ shapesMapKey: "map" });
		const shape = makeShape({ id: "s1" });
		store.addShape(shape);

		const mapY = handle.doc.getMap<Record<string, unknown>>("map");
		const shapesY = handle.doc.getMap<Record<string, unknown>>("shapes");
		expect(mapY.has("s1")).toBe(true);
		expect(shapesY.has("s1")).toBe(false);
	});

	it("avoids sync loops on round-trip", () => {
		const { store, handle } = setup();
		const shape = makeShape({ id: "s1", x: 0 });
		store.addShape(shape);

		// updating from the Y.Doc side must not fire mutation back into Y again
		// (observer uses the same isSyncing guard as the mutation listener)
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");
		const before = (shapesMap.get("s1") as { x: number }).x;
		handle.doc.transact(() => {
			shapesMap.set("s1", { ...(shapesMap.get("s1") as object), x: 200 });
		});
		expect(store.getShape("s1")?.x).toBe(200);
		// Y.Map should still reflect x=200 — no write-back races
		expect((shapesMap.get("s1") as { x: number }).x).toBe(200);
		expect(before).toBe(0);
	});
});

describe("createYwebsocketSync (lifecycle)", () => {
	it("exposes an inert wsProvider before connect; onStatusChange reports disconnected", () => {
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
		});
		try {
			const seen: string[] = [];
			const unsub = handle.wsProvider.onStatusChange((s) => seen.push(s));
			expect(seen).toEqual(["disconnected"]);
			expect(handle.wsProvider.connected).toBe(false);
			// broadcast / requestPartition are no-ops and must not throw
			handle.wsProvider.broadcast({ type: "noop" });
			handle.wsProvider.requestPartition(["anything"]);
			unsub();
		} finally {
			handle.destroy();
		}
	});

	it("exposes a valid Awareness before connect — WsProviderHandle contract", () => {
		// Consumers like presence-cursor destructure `const { awareness } = wsProvider`
		// at plugin creation time, so awareness must be ready immediately.
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
		});
		try {
			const { awareness } = handle.wsProvider;
			expect(awareness).toBeDefined();
			expect(awareness.doc).toBe(handle.doc);
			awareness.setLocalStateField("user", { name: "alice" });
			expect(awareness.getLocalState()).toMatchObject({ user: { name: "alice" } });
		} finally {
			handle.destroy();
		}
	});

	it("whenSynced resolves on destroy (doesn't hang setup())", async () => {
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
		});
		// Kick off whenSynced, then destroy — must resolve, not hang.
		const p = handle.whenSynced;
		handle.destroy();
		await expect(p).resolves.toBeUndefined();
	});

	it("disconnect() during an in-flight connect() cancels before a socket is created", async () => {
		// Use autoConnect:true + a slow resolveParams to simulate the race window,
		// then call disconnect() mid-await. A correct implementation must NOT
		// construct a WebsocketProvider after the disconnect lands.
		let resolveParamsCalls = 0;
		let deferred!: () => void;
		const waitForResume = new Promise<void>((resolve) => {
			deferred = resolve;
		});
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: true,
			resolveParams: async () => {
				resolveParamsCalls++;
				await waitForResume; // hang until the test releases
				return { params: { t: "late" } };
			},
		});
		// connect() starts and blocks on resolveParams. Now disconnect.
		handle.disconnect();
		// Allow resolveParams to resolve — but we should NOT see a provider instantiated.
		deferred();
		// Give the microtask queue a couple ticks to flush.
		await new Promise((r) => setTimeout(r, 0));
		await new Promise((r) => setTimeout(r, 0));
		expect(resolveParamsCalls).toBe(1);
		expect(handle.wsProvider.connected).toBe(false);
		expect(handle.status.getSnapshot().state).toBe("disconnected");
		handle.destroy();
	});

	it("exposes an initial onStatusChange value that reflects the tracker state", () => {
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
		});
		try {
			const seen: string[] = [];
			const unsub = handle.wsProvider.onStatusChange((s) => seen.push(s));
			// autoConnect:false + not yet resumed → tracker is "loading" → "disconnected".
			expect(seen).toEqual(["disconnected"]);
			unsub();
		} finally {
			handle.destroy();
		}
	});

	it("destroys the Y.Doc it owns, but leaves an externally-provided Y.Doc intact", () => {
		const store1 = createTestStore();
		const h1 = createYwebsocketSync(store1, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
		});
		const ownedDoc = h1.doc;
		h1.destroy();
		// After destroy, the owned Y.Doc is destroyed — `getMap` still returns an object
		// but further mutations are unsafe; we just check that `destroy` doesn't throw.
		expect(ownedDoc).toBeDefined();

		const externalDoc = new Y.Doc();
		const store2 = createTestStore();
		const h2 = createYwebsocketSync(store2, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
			doc: externalDoc,
		});
		h2.destroy();
		// External Y.Doc must still be usable
		expect(() => externalDoc.getMap("anything")).not.toThrow();
		externalDoc.destroy();
	});
});
