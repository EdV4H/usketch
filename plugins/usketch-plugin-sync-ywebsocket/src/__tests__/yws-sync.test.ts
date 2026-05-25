import type { ShapeData } from "@edv4h/usketch-shared";
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

describe("createYwebsocketSync (shouldSync filter)", () => {
	const handles: YwebsocketSyncHandle[] = [];

	afterEach(() => {
		while (handles.length) {
			handles.pop()?.destroy();
		}
	});

	function setup(shouldSync: (shape: ShapeData) => boolean, opts: { doc?: Y.Doc } = {}) {
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "test-room",
			autoConnect: false,
			shouldSync,
			doc: opts.doc,
		});
		handles.push(handle);
		return { store, handle };
	}

	it("skips local additions whose shouldSync returns false", () => {
		const { store, handle } = setup((shape) => shape.id.startsWith("native-"));

		store.addShape(makeShape({ id: "native-1" }));
		store.addShape(makeShape({ id: "foreign-1" }));

		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");
		expect(shapesMap.has("native-1")).toBe(true);
		expect(shapesMap.has("foreign-1")).toBe(false);
		// Local store still contains both — only the Y.Map mirror is filtered.
		expect(store.getShape("native-1")).toBeDefined();
		expect(store.getShape("foreign-1")).toBeDefined();
	});

	it("does not delete from Y.Map when removing a shape that was never synced", () => {
		const { store, handle } = setup((shape) => shape.id.startsWith("native-"));
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");

		// Pre-seed Y.Map with a value that mimics another writer's content. The
		// filter excludes "foreign-*", so removing it locally must NOT propagate
		// a `shapesMap.delete("foreign-1")` that would clobber the other writer.
		handle.doc.transact(() => {
			shapesMap.set("foreign-1", { id: "foreign-1", x: 99 });
		});
		// The transact above flowed through the observer and stored the shape
		// in the local store + marked it as synced. Reset state to model a
		// scenario where the host bridge inserts the foreign shape directly
		// without going through Y.Map first.
		shapesMap.delete("foreign-1");
		store.deleteShape("foreign-1");

		store.addShape(makeShape({ id: "foreign-1" }));
		expect(shapesMap.has("foreign-1")).toBe(false);

		store.deleteShape("foreign-1");
		// Foreign shape was never synced → no propagation. Re-add the foreign
		// entry directly to assert it survives the deletion.
		handle.doc.transact(() => {
			shapesMap.set("foreign-1", { id: "foreign-1", x: 99 });
		});
		// Now make sure a subsequent local delete-without-sync doesn't drop it.
		store.addShape(makeShape({ id: "foreign-2" }));
		store.deleteShape("foreign-2");
		expect(shapesMap.has("foreign-1")).toBe(true);
	});

	it("deletes from Y.Map when removing a shape the host had opted into syncing", () => {
		const { store, handle } = setup(() => true);
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");

		store.addShape(makeShape({ id: "s1" }));
		expect(shapesMap.has("s1")).toBe(true);

		store.deleteShape("s1");
		expect(shapesMap.has("s1")).toBe(false);
	});

	it("removes a previously-synced entry when shouldSync flips to false for the same id", () => {
		let allow = true;
		const { store, handle } = setup(() => allow);
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");

		store.addShape(makeShape({ id: "s1", x: 0 }));
		expect(shapesMap.has("s1")).toBe(true);

		allow = false;
		store.updateShape("s1", { x: 10 });
		// The host has retroactively opted "s1" out — the stale Y.Map entry
		// must be cleared so the shared document stops mirroring it.
		expect(shapesMap.has("s1")).toBe(false);
	});

	it("does not evict remote-origin shapes from the Y.Map when shouldSync rejects them locally", () => {
		// Regression: when one Set tracked both "locally authored" and "observed
		// from remote" ids, a shouldSync=false on a remote-origin shape's local
		// update would delete the remote-origin entry from the shared doc —
		// turning a foreign-mirrored update into a destructive write that hit
		// every other client. Locally-authored vs observed are now separate.
		const { store, handle } = setup((shape) => shape.id.startsWith("native-"));
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");

		handle.doc.transact(() => {
			shapesMap.set("foreign-from-remote", {
				id: "foreign-from-remote",
				type: "rect",
				x: 1,
				y: 2,
				width: 10,
				height: 10,
				style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
			});
		});
		// Bridge layer updates the locally mirrored shape — must not propagate.
		store.updateShape("foreign-from-remote", { x: 999 });
		// The shared doc still holds the remote-origin entry untouched.
		expect(shapesMap.has("foreign-from-remote")).toBe(true);
		expect((shapesMap.get("foreign-from-remote") as { x: number }).x).toBe(1);
	});

	it("propagates removals for shapes that originated from a remote Y.Map update", () => {
		const { store, handle } = setup((shape) => shape.id.startsWith("native-"));
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");

		// Simulate a remote write of a "foreign-" shape. shouldSync would normally
		// reject it on the local path, but the Y.Map observer is read-only and
		// must mirror it into the local store regardless.
		handle.doc.transact(() => {
			shapesMap.set("foreign-from-remote", {
				id: "foreign-from-remote",
				type: "rect",
				x: 1,
				y: 2,
				width: 10,
				height: 10,
				style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
			});
		});
		expect(store.getShape("foreign-from-remote")).toBeDefined();

		// Local deletion of that remote shape must propagate — the host expects
		// its remove handler to reach the shared doc when the shape was sourced
		// from the shared doc to begin with.
		store.deleteShape("foreign-from-remote");
		expect(shapesMap.has("foreign-from-remote")).toBe(false);
	});

	it("notes the new entry when shouldSync flips false → true on a subsequent update", () => {
		let allow = false;
		const { store, handle } = setup(() => allow);

		// Initially blocked: store gets it, Y.Map doesn't, and the status tracker
		// must not know about an id we never wrote.
		store.addShape(makeShape({ id: "s1" }));
		expect(handle.status.getSnapshot().shapeCount).toBe(0);
		expect(handle.status.getSnapshot().unconfirmedShapeIds).not.toContain("s1");

		// Filter flips on; the next update is the first time we forward this id
		// to the Y.Map. The status tracker must register the new entry now —
		// otherwise the divergence UI would silently miss it.
		allow = true;
		store.updateShape("s1", { x: 50 });

		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");
		expect(shapesMap.has("s1")).toBe(true);
		// `autoConnect: false` → currentWsStatus stays "disconnected", so the new
		// entry is flagged as a local (unconfirmed) add. The exact category
		// matters less than the fact that the tracker knows about it.
		expect(handle.status.getSnapshot().shapeCount).toBe(1);
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toContain("s1");
	});

	it("defaults to syncing everything when shouldSync is omitted", () => {
		// Re-uses the no-filter path of the main test setup, included here as an
		// explicit regression assertion that the new gate doesn't kick in when
		// the option is left unset.
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "test-room",
			autoConnect: false,
		});
		handles.push(handle);

		store.addShape(makeShape({ id: "anything" }));
		const shapesMap = handle.doc.getMap<Record<string, unknown>>("shapes");
		expect(shapesMap.has("anything")).toBe(true);
	});
});

describe("createYwebsocketSync (divergence tracking)", () => {
	const handles: YwebsocketSyncHandle[] = [];

	afterEach(() => {
		while (handles.length) {
			handles.pop()?.destroy();
		}
	});

	function setup() {
		const store = createTestStore();
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "test-room",
			autoConnect: false,
		});
		handles.push(handle);
		return { store, handle };
	}

	it("flags shapes added while offline as unconfirmed", () => {
		const { store, handle } = setup();
		// `autoConnect: false` → currentWsStatus is "disconnected".
		store.addShape(makeShape({ id: "offline-1" }));
		store.addShape(makeShape({ id: "offline-2" }));
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual(["offline-1", "offline-2"]);
	});

	it("setConfirmedFromServer clears unconfirmed for shapes the server knows", () => {
		const { store, handle } = setup();
		store.addShape(makeShape({ id: "a" }));
		store.addShape(makeShape({ id: "b" }));
		// Simulate the `sync` event landing — both shapes are now in the
		// merged server view.
		handle.status.setConfirmedFromServer(["a", "b"]);
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual([]);
	});

	it("a shape on the client but absent from the server snapshot stays unconfirmed", () => {
		// The phantom-shape scenario: server's view does NOT contain `ghost`.
		const { store, handle } = setup();
		store.addShape(makeShape({ id: "ghost" }));
		store.addShape(makeShape({ id: "real" }));
		handle.status.setConfirmedFromServer(["real"]);
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual(["ghost"]);
	});

	it("removing an unconfirmed shape drops it from the divergence list", () => {
		const { store, handle } = setup();
		store.addShape(makeShape({ id: "tmp" }));
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual(["tmp"]);
		store.deleteShape("tmp");
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual([]);
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
