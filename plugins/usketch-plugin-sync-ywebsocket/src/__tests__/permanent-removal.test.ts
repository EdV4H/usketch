import {
	isPermanentlyRemoved,
	removeShapePermanently,
	type StoreEvent,
} from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { DEFAULT_PERMANENT_REMOVALS_MAP_KEY } from "@edv4h/usketch-sync";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { YwebsocketSyncHandle } from "../types.js";
import { createYwebsocketSync } from "../yws-sync.js";
import { makeShape } from "./test-store.js";

// 2 つのクライアント（それぞれ本物の store + Y.Doc）を、オン/オフできる線で繋ぐ。
describe("permanent removal across two clients", () => {
	const handles: YwebsocketSyncHandle[] = [];
	afterEach(() => {
		while (handles.length) handles.pop()?.destroy();
	});

	function client(doc = new Y.Doc()) {
		const store = createBoardStore();
		const permanentEvents: StoreEvent[] = [];
		store.onMutation((event) => {
			if (event.type === "shape:removed" && event.payload.permanent) permanentEvents.push(event);
		});
		const handle = createYwebsocketSync(store, {
			url: "ws://example.invalid",
			roomName: "room",
			autoConnect: false,
			doc,
		});
		handles.push(handle);
		return { store, doc, permanentEvents, shapes: doc.getMap("shapes") };
	}

	/** `a` と `b` の doc を繋ぐ。`online = false` の間は届かず、戻したときに差分を交換する。 */
	function link(docA: Y.Doc, docB: Y.Doc) {
		let online = true;
		docA.on("update", (update: Uint8Array, origin: unknown) => {
			if (online && origin !== "peer") Y.applyUpdate(docB, update, "peer");
		});
		docB.on("update", (update: Uint8Array, origin: unknown) => {
			if (online && origin !== "peer") Y.applyUpdate(docA, update, "peer");
		});
		return {
			offline() {
				online = false;
			},
			online() {
				online = true;
				Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB)), "peer");
				Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA)), "peer");
			},
		};
	}

	function pair() {
		const a = client();
		const b = client();
		const net = link(a.doc, b.doc);
		return { a, b, net };
	}

	it("removes the shape on both clients, firing one permanent shape:removed each with the shape", () => {
		const { a, b } = pair();
		a.store.addShape(makeShape({ id: "skewer", type: "skewer" }));
		expect(b.store.getShape("skewer")).toBeDefined();

		expect(removeShapePermanently(a.store, "skewer", { expectedType: "skewer" })).toBe(true);

		for (const c of [a, b]) {
			expect(c.store.getShape("skewer")).toBeUndefined();
			expect(isPermanentlyRemoved(c.store, "skewer")).toBe(true);
			expect(c.shapes.has("skewer")).toBe(false);
			expect(c.permanentEvents).toHaveLength(1);
			const event = c.permanentEvents[0];
			expect(event?.type === "shape:removed" && event.payload.shape?.type).toBe("skewer");
		}
		expect(a.doc.getMap(DEFAULT_PERMANENT_REMOVALS_MAP_KEY).get("skewer")).toBe(true);
	});

	it("isn't brought back by the other client's concurrent update", () => {
		const { a, b, net } = pair();
		a.store.addShape(makeShape({ id: "s" }));
		net.offline();
		b.store.updateShape("s", { x: 50 });
		removeShapePermanently(a.store, "s");
		net.online();

		for (const c of [a, b]) {
			expect(c.store.getShape("s")).toBeUndefined();
			expect(c.shapes.has("s")).toBe(false);
			expect(c.permanentEvents).toHaveLength(1);
		}
		// A later update from the stale side changes nothing either.
		b.store.updateShape("s", { x: 60 });
		expect(a.store.getShape("s")).toBeUndefined();
	});

	it("isn't brought back by the other client's Yjs undo / redo", () => {
		const { a, b } = pair();
		a.store.addShape(makeShape({ id: "s", x: 0 }));
		const undoB = new Y.UndoManager(b.shapes, { captureTimeout: 0 });
		b.store.updateShape("s", { x: 50 });
		removeShapePermanently(a.store, "s");

		// Undoing B's move writes the old `s` back into the shared map; redo writes the moved one.
		undoB.undo();
		for (const c of [a, b]) {
			expect(c.store.getShape("s")).toBeUndefined();
			expect(c.shapes.has("s")).toBe(false);
		}
		undoB.redo();
		for (const c of [a, b]) {
			expect(c.store.getShape("s")).toBeUndefined();
			expect(c.shapes.has("s")).toBe(false);
			expect(c.permanentEvents).toHaveLength(1);
		}
		undoB.destroy();
	});

	it("doesn't add an undo step to a host's Yjs UndoManager", () => {
		const { a } = pair();
		a.store.addShape(makeShape({ id: "s" }));
		const undoA = new Y.UndoManager(a.shapes, { captureTimeout: 0 });
		removeShapePermanently(a.store, "s");
		expect(undoA.undoStack).toHaveLength(0);
		undoA.destroy();
	});

	it("keeps it gone for a client that joins later", () => {
		const { a } = pair();
		a.store.addShape(makeShape({ id: "s" }));
		removeShapePermanently(a.store, "s");

		const lateDoc = new Y.Doc();
		Y.applyUpdate(lateDoc, Y.encodeStateAsUpdate(a.doc), "peer");
		const late = client(lateDoc);
		expect(late.store.getShape("s")).toBeUndefined();
		expect(isPermanentlyRemoved(late.store, "s")).toBe(true);
		// Nothing was on this board, so there's nothing to tell.
		expect(late.permanentEvents).toHaveLength(0);
	});

	it("removes it from a client reloading an old copy of the board", () => {
		const { a } = pair();
		a.store.addShape(makeShape({ id: "s" }));
		const oldCopy = Y.encodeStateAsUpdate(a.doc);
		removeShapePermanently(a.store, "s");

		const staleDoc = new Y.Doc();
		Y.applyUpdate(staleDoc, oldCopy, "idb");
		const stale = client(staleDoc);
		expect(stale.store.getShape("s")).toBeDefined();
		link(a.doc, stale.doc).online();

		expect(stale.store.getShape("s")).toBeUndefined();
		expect(stale.shapes.has("s")).toBe(false);
		expect(stale.permanentEvents).toHaveLength(1);
	});

	it("leaves ordinary removals unchanged", () => {
		const { a, b } = pair();
		a.store.addShape(makeShape({ id: "s" }));
		a.store.deleteShape("s");
		expect(b.store.getShape("s")).toBeUndefined();
		a.store.addShape(makeShape({ id: "s" }));
		expect(b.store.getShape("s")).toBeDefined();
		expect(a.doc.getMap(DEFAULT_PERMANENT_REMOVALS_MAP_KEY).size).toBe(0);
	});
});
