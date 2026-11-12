import { decodeDocFrame, encodeDocFrame, MSG_DOC_SYNC, MSG_DOC_UPDATE } from "@edv4h/usketch-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { readChunked } from "../chunked-storage.js";
import {
	createPageDocs,
	MAX_SUBSCRIPTIONS_PER_SOCKET,
	type PageDocSocket,
	pageStateKey,
	subscribedDocIds,
} from "../page-docs.js";
import { STATE_KEY } from "../yjs-sync.js";

/** Minimal in-memory stand-in for DurableObjectStorage. */
function fakeStorage() {
	const map = new Map<string, unknown>();
	const storage = {
		get: async (key: string | string[]) => {
			if (!Array.isArray(key)) return map.get(key);
			const out = new Map<string, unknown>();
			for (const k of key) if (map.has(k)) out.set(k, map.get(k));
			return out;
		},
		put: async (key: string | Record<string, unknown>, value?: unknown) => {
			if (typeof key === "string") map.set(key, value);
			else for (const [k, v] of Object.entries(key)) map.set(k, v);
		},
		list: async ({ prefix }: { prefix: string }) =>
			new Map([...map].filter(([k]) => k.startsWith(prefix))),
		delete: async (key: string | string[]) => {
			if (!Array.isArray(key)) return map.delete(key);
			let n = 0;
			for (const k of key) if (map.delete(k)) n++;
			return n;
		},
	} as unknown as DurableObjectStorage;
	return { storage, map };
}

/** WebSocket の代わり: 受け取ったメッセージと attachment だけを持つ。 */
class FakeSocket implements PageDocSocket {
	received: Uint8Array[] = [];
	private attachment: unknown = null;
	send(data: string | ArrayBuffer | ArrayBufferView) {
		this.received.push(new Uint8Array(data as Uint8Array));
	}
	serializeAttachment(value: unknown) {
		this.attachment = structuredClone(value);
	}
	deserializeAttachment() {
		return this.attachment;
	}
	frames() {
		return this.received.map((d) => decodeDocFrame(d)).filter((f) => f !== null);
	}
}

/** 1 つのクライアント: ソケットと、そのクライアントが持つページ doc。 */
function client() {
	return { ws: new FakeSocket(), doc: new Y.Doc() };
}

/** サーバーから届いた DOC_SYNC / DOC_UPDATE を doc に適用する。 */
function applyReceived(c: ReturnType<typeof client>, docId: string) {
	for (const frame of c.ws.frames()) {
		if (frame.docId !== docId) continue;
		if (frame.type === MSG_DOC_SYNC || frame.type === MSG_DOC_UPDATE) {
			const [update] = frame.parts;
			if (update) Y.applyUpdate(c.doc, update, "remote");
		}
	}
	c.ws.received = [];
}

describe("createPageDocs", () => {
	let sockets: FakeSocket[];
	let storage: ReturnType<typeof fakeStorage>;
	let pages: ReturnType<typeof createPageDocs>;

	beforeEach(() => {
		vi.useFakeTimers();
		sockets = [];
		storage = fakeStorage();
		pages = createPageDocs({ storage: storage.storage, getSockets: () => sockets });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function connect() {
		const c = client();
		sockets.push(c.ws);
		return c;
	}

	/** クライアントの編集を DOC_UPDATE としてサーバーへ送る。 */
	async function edit(c: ReturnType<typeof client>, docId: string, fn: (doc: Y.Doc) => void) {
		const updates: Uint8Array[] = [];
		const onUpdate = (u: Uint8Array) => updates.push(u);
		c.doc.on("update", onUpdate);
		fn(c.doc);
		c.doc.off("update", onUpdate);
		for (const u of updates) expect(await pages.handleUpdate(c.ws, docId, u)).toBe(true);
	}

	it("syncs an empty doc and records the subscription on the socket", async () => {
		const a = connect();
		expect(await pages.handleSubscribe(a.ws, "p1", Y.encodeStateVector(a.doc))).toBe(true);
		expect(subscribedDocIds(a.ws)).toEqual(["p1"]);
		const [sync] = a.ws.frames();
		expect(sync?.type).toBe(MSG_DOC_SYNC);
		expect(sync?.parts).toHaveLength(2);
		expect(pages.loadedDocIds()).toEqual(["p1"]);
	});

	it("relays updates only to other subscribers of the same doc", async () => {
		const a = connect();
		const b = connect();
		const c = connect();
		await pages.handleSubscribe(a.ws, "p1", Y.encodeStateVector(a.doc));
		await pages.handleSubscribe(b.ws, "p1", Y.encodeStateVector(b.doc));
		await pages.handleSubscribe(c.ws, "p2", Y.encodeStateVector(c.doc));
		for (const s of sockets) s.received = [];

		await edit(a, "p1", (doc) => doc.getMap("shapes").set("s1", { id: "s1" }));
		expect(a.ws.received).toHaveLength(0);
		expect(c.ws.received).toHaveLength(0);
		applyReceived(b, "p1");
		expect(b.doc.getMap("shapes").get("s1")).toEqual({ id: "s1" });
	});

	it("sends a late subscriber only what it is missing", async () => {
		const a = connect();
		await pages.handleSubscribe(a.ws, "p1", Y.encodeStateVector(a.doc));
		await edit(a, "p1", (doc) => {
			doc.getMap("shapes").set("s1", { id: "s1" });
			doc.getMap("shapes").set("s2", { id: "s2" });
		});

		// b は a と同じ中身をすでに持っている（IndexedDB から読んだ想定）
		const b = connect();
		Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
		await pages.handleSubscribe(b.ws, "p1", Y.encodeStateVector(b.doc));
		const [sync] = b.ws.frames();
		const [diff, serverStateVector] = sync?.parts ?? [];
		if (!diff) throw new Error("no diff");
		// 差分には新しいシェイプが含まれない
		const probe = new Y.Doc();
		Y.applyUpdate(probe, diff);
		expect(probe.getMap("shapes").size).toBe(0);
		expect(serverStateVector).toBeDefined();

		// c は何も持っていない
		const c = connect();
		await pages.handleSubscribe(c.ws, "p1", Y.encodeStateVector(c.doc));
		applyReceived(c, "p1");
		expect([...c.doc.getMap("shapes").keys()].sort()).toEqual(["s1", "s2"]);
	});

	it("ignores updates for docs the socket has not subscribed to", async () => {
		const a = connect();
		const other = new Y.Doc();
		other.getMap("shapes").set("x", { id: "x" });
		expect(await pages.handleUpdate(a.ws, "p1", Y.encodeStateAsUpdate(other))).toBe(false);
		expect(pages.loadedDocIds()).toEqual([]);
	});

	it("rejects invalid ids and too many subscriptions", async () => {
		const a = connect();
		expect(await pages.handleSubscribe(a.ws, "bad:id", undefined)).toBe(false);
		for (let i = 0; i < MAX_SUBSCRIPTIONS_PER_SOCKET; i++) {
			expect(await pages.handleSubscribe(a.ws, `p${i}`, undefined)).toBe(true);
		}
		expect(await pages.handleSubscribe(a.ws, "one-more", undefined)).toBe(false);
		// 既に購読している doc への再購読は数えない
		expect(await pages.handleSubscribe(a.ws, "p0", undefined)).toBe(true);
	});

	it("persists each doc under its own key and restores it after release", async () => {
		const a = connect();
		await pages.handleSubscribe(a.ws, "p1", Y.encodeStateVector(a.doc));
		await edit(a, "p1", (doc) => doc.getMap("shapes").set("s1", { id: "s1", x: 1 }));
		await vi.advanceTimersByTimeAsync(5_000);

		const saved = await readChunked(storage.storage, pageStateKey("p1"));
		expect(saved).toBeDefined();
		// ルート doc のキーには書かない
		expect(await readChunked(storage.storage, STATE_KEY)).toBeUndefined();

		pages.handleUnsubscribe(a.ws, "p1");
		expect(subscribedDocIds(a.ws)).toEqual([]);
		expect(pages.loadedDocIds()).toEqual([]);

		const b = connect();
		await pages.handleSubscribe(b.ws, "p1", Y.encodeStateVector(b.doc));
		applyReceived(b, "p1");
		expect(b.doc.getMap("shapes").get("s1")).toEqual({ id: "s1", x: 1 });
	});

	it("keeps an unsaved doc in memory until its save finishes", async () => {
		const a = connect();
		await pages.handleSubscribe(a.ws, "p1", Y.encodeStateVector(a.doc));
		await edit(a, "p1", (doc) => doc.getMap("shapes").set("s1", { id: "s1" }));
		sockets.splice(sockets.indexOf(a.ws), 1);
		pages.handleClose(a.ws);
		// 保存がまだなので外さない
		expect(pages.loadedDocIds()).toEqual(["p1"]);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(pages.loadedDocIds()).toEqual([]);
		expect(await readChunked(storage.storage, pageStateKey("p1"))).toBeDefined();
	});

	it("keeps a doc loaded while another socket still subscribes to it", async () => {
		const a = connect();
		const b = connect();
		await pages.handleSubscribe(a.ws, "p1", undefined);
		await pages.handleSubscribe(b.ws, "p1", undefined);
		pages.handleUnsubscribe(a.ws, "p1");
		expect(pages.loadedDocIds()).toEqual(["p1"]);
		pages.handleClose(b.ws);
		expect(pages.loadedDocIds()).toEqual([]);
	});

	it("does not relay or keep a corrupt update", async () => {
		const a = connect();
		const b = connect();
		await pages.handleSubscribe(a.ws, "p1", undefined);
		await pages.handleSubscribe(b.ws, "p1", undefined);
		b.ws.received = [];
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		expect(await pages.handleUpdate(a.ws, "p1", new Uint8Array([255, 255, 255]))).toBe(false);
		errorSpy.mockRestore();
		expect(b.ws.received).toHaveLength(0);
	});

	it("round-trips frames through the shared protocol encoder", () => {
		const frame = encodeDocFrame(MSG_DOC_UPDATE, "p1", [new Uint8Array([1])]);
		expect(decodeDocFrame(frame)?.docId).toBe("p1");
	});
});
