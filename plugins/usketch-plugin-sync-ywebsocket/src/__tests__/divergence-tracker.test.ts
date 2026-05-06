import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createDivergenceTracker } from "../divergence-tracker.js";
import { createTestStore, makeShape } from "./test-store.js";

/**
 * Helper: build the smallest possible setup the divergence tracker needs.
 * Mirrors what `apps/web/src/app.tsx` does (IDB sync handle's doc/shapesMap +
 * a WsProvider-style status callback) without touching the real IDB or
 * WebSocket code.
 */
function setup() {
	const doc = new Y.Doc();
	const shapesMap = doc.getMap<Record<string, unknown>>("shapes");
	const store = createTestStore();
	const statusListeners = new Set<(status: string) => void>();
	let currentStatus = "disconnected";

	const handle = createDivergenceTracker({
		store,
		doc,
		shapesMap,
		onConnectionStatusChange: (handler) => {
			statusListeners.add(handler);
			handler(currentStatus);
			return () => statusListeners.delete(handler);
		},
	});

	function setWsStatus(next: string) {
		currentStatus = next;
		for (const l of statusListeners) l(next);
	}

	function applyRemoteUpdate(update: Uint8Array) {
		Y.applyUpdate(doc, update, "remote");
	}

	function makeRemoteAddUpdate(id: string): Uint8Array {
		const tmpDoc = new Y.Doc();
		const tmpMap = tmpDoc.getMap<Record<string, unknown>>("shapes");
		tmpMap.set(id, makeShape({ id }) as unknown as Record<string, unknown>);
		return Y.encodeStateAsUpdate(tmpDoc);
	}

	return { doc, shapesMap, store, handle, setWsStatus, applyRemoteUpdate, makeRemoteAddUpdate };
}

describe("createDivergenceTracker", () => {
	it("flags a locally-added shape as unconfirmed while offline", () => {
		const { store, handle } = setup();
		store.addShape(makeShape({ id: "offline-1" }));
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual(["offline-1"]);
		handle.destroy();
	});

	it("does NOT flag locally-added shapes while online (server will broadcast immediately)", () => {
		const { store, handle, setWsStatus } = setup();
		setWsStatus("connected");
		store.addShape(makeShape({ id: "online-1" }));
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual([]);
		handle.destroy();
	});

	it("first remote-origin doc update stamps firstServerSyncAt", () => {
		const { handle, applyRemoteUpdate, makeRemoteAddUpdate } = setup();
		expect(handle.status.getSnapshot().firstServerSyncAt).toBeNull();

		// Server sends a remote update — this is our "first sync" signal.
		applyRemoteUpdate(makeRemoteAddUpdate("server-1"));

		const snap = handle.status.getSnapshot();
		expect(snap.firstServerSyncAt).not.toBeNull();
		expect(typeof snap.firstServerSyncAt).toBe("number");
		// The shape from the server is confirmed, not unconfirmed.
		expect(snap.unconfirmedShapeIds).toEqual([]);
		handle.destroy();
	});

	it("a shape created locally before first sync stays unconfirmed if server didn't include it", () => {
		// Phantom shape scenario: client added X offline; server's first sync
		// arrives but didn't actually contain X. After the sync, the divergence
		// snapshot should still flag X.
		const { store, handle, applyRemoteUpdate, makeRemoteAddUpdate } = setup();
		store.addShape(makeShape({ id: "ghost" }));
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual(["ghost"]);

		// Server's first sync only confirms `server-1` (no `ghost`).
		applyRemoteUpdate(makeRemoteAddUpdate("server-1"));

		const snap = handle.status.getSnapshot();
		expect(snap.firstServerSyncAt).not.toBeNull();
		// `ghost` is in shapesMap (we added it locally) but not in the
		// confirmed snapshot, so it remains in `unconfirmedShapeIds`.
		expect(snap.unconfirmedShapeIds).toEqual(["ghost"]);
		handle.destroy();
	});

	it("after first sync, going offline and adding a shape flags it as unconfirmed", () => {
		const { store, handle, setWsStatus, applyRemoteUpdate, makeRemoteAddUpdate } = setup();
		setWsStatus("connected");
		applyRemoteUpdate(makeRemoteAddUpdate("server-1"));

		// Drop offline, add a shape — should diverge.
		setWsStatus("disconnected");
		store.addShape(makeShape({ id: "offline-2" }));
		expect(handle.status.getSnapshot().unconfirmedShapeIds).toEqual(["offline-2"]);
		handle.destroy();
	});

	it("destroy() unsubscribes everything — later mutations don't notify", () => {
		const { store, handle, setWsStatus } = setup();
		let calls = 0;
		handle.status.subscribe(() => {
			calls++;
		});
		handle.destroy();
		setWsStatus("connected");
		store.addShape(makeShape({ id: "after-destroy" }));
		expect(calls).toBe(0);
	});
});
