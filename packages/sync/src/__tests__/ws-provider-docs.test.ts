import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
	decodeDocFrame,
	encodeDocFrame,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_SYNC,
	MSG_DOC_UNSUBSCRIBE,
	MSG_DOC_UPDATE,
} from "../protocol.js";
import { createWsProvider, type WsProviderHandle } from "../ws-provider.js";

/** WebSocket の代わり。送ったメッセージを貯め、受信は deliver で起こす。 */
class FakeSocket {
	static readonly OPEN = 1;
	static instances: FakeSocket[] = [];
	readyState = 0;
	binaryType = "blob";
	sent: Uint8Array[] = [];
	private listeners = new Map<string, ((event: unknown) => void)[]>();

	constructor(readonly url: string) {
		FakeSocket.instances.push(this);
	}
	addEventListener(type: string, fn: (event: unknown) => void) {
		this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
	}
	send(data: Uint8Array) {
		this.sent.push(new Uint8Array(data));
	}
	close() {
		this.readyState = 3;
		this.emit("close", {});
	}
	open() {
		this.readyState = FakeSocket.OPEN;
		this.emit("open", {});
	}
	deliver(data: Uint8Array) {
		const copy = new Uint8Array(data);
		this.emit("message", { data: copy.buffer });
	}
	/** 送った DOC_* メッセージ（ルート doc 用のものは除く）。 */
	docFrames() {
		return this.sent
			.map((d) => decodeDocFrame(d))
			.filter((f) => f !== null && f.type >= MSG_DOC_SUBSCRIBE);
	}
	private emit(type: string, event: unknown) {
		for (const fn of this.listeners.get(type) ?? []) fn(event);
	}
}

const realWebSocket = globalThis.WebSocket;
let provider: WsProviderHandle | null = null;

beforeEach(() => {
	FakeSocket.instances = [];
	(globalThis as { WebSocket: unknown }).WebSocket = FakeSocket;
});

afterEach(() => {
	provider?.destroy();
	provider = null;
	(globalThis as { WebSocket: unknown }).WebSocket = realWebSocket;
});

function setup() {
	provider = createWsProvider({ url: "ws://test", doc: new Y.Doc() });
	const socket = FakeSocket.instances[0];
	if (!socket) throw new Error("no socket");
	return { provider, socket };
}

describe("WsProvider.subscribeDoc", () => {
	it("subscribes on open with the doc's state vector and applies DOC_SYNC", async () => {
		const { provider, socket } = setup();
		const page = new Y.Doc();
		const sub = provider.subscribeDoc("p1", page);
		socket.open();

		const subscribe = socket.docFrames().find((f) => f?.type === MSG_DOC_SUBSCRIBE);
		expect(subscribe?.docId).toBe("p1");
		expect([...(subscribe?.parts[0] ?? [])]).toEqual([...Y.encodeStateVector(page)]);

		const server = new Y.Doc();
		server.getMap("shapes").set("a", { id: "a" });
		socket.deliver(
			encodeDocFrame(MSG_DOC_SYNC, "p1", [
				Y.encodeStateAsUpdate(server),
				Y.encodeStateVector(server),
			]),
		);
		await sub.whenSynced;
		expect(page.getMap("shapes").get("a")).toEqual({ id: "a" });
		// サーバーに足りないものは無いので送り返さない
		expect(socket.docFrames().filter((f) => f?.type === MSG_DOC_UPDATE)).toHaveLength(0);
	});

	it("sends back edits the server is missing after DOC_SYNC", () => {
		const { provider, socket } = setup();
		const page = new Y.Doc();
		page.getMap("shapes").set("offline", { id: "offline" });
		provider.subscribeDoc("p1", page);
		socket.open();
		const server = new Y.Doc();
		socket.deliver(
			encodeDocFrame(MSG_DOC_SYNC, "p1", [
				Y.encodeStateAsUpdate(server),
				Y.encodeStateVector(server),
			]),
		);

		const updates = socket.docFrames().filter((f) => f?.type === MSG_DOC_UPDATE);
		expect(updates).toHaveLength(1);
		const [update] = updates[0]?.parts ?? [];
		if (!update) throw new Error("no update");
		Y.applyUpdate(server, update);
		expect(server.getMap("shapes").get("offline")).toEqual({ id: "offline" });
	});

	it("streams local edits as DOC_UPDATE and does not echo remote ones", () => {
		const { provider, socket } = setup();
		const page = new Y.Doc();
		provider.subscribeDoc("p1", page);
		socket.open();
		page.getMap("shapes").set("local", { id: "local" });
		expect(socket.docFrames().filter((f) => f?.type === MSG_DOC_UPDATE)).toHaveLength(1);

		const other = new Y.Doc();
		other.getMap("shapes").set("remote", { id: "remote" });
		socket.deliver(encodeDocFrame(MSG_DOC_UPDATE, "p1", [Y.encodeStateAsUpdate(other)]));
		expect(page.getMap("shapes").get("remote")).toEqual({ id: "remote" });
		expect(socket.docFrames().filter((f) => f?.type === MSG_DOC_UPDATE)).toHaveLength(1);
	});

	it("keeps root doc traffic separate", () => {
		const root = new Y.Doc();
		provider = createWsProvider({ url: "ws://test", doc: root });
		const socket = FakeSocket.instances[0];
		if (!socket) throw new Error("no socket");
		const page = new Y.Doc();
		provider.subscribeDoc("p1", page);
		socket.open();
		const other = new Y.Doc();
		other.getMap("shapes").set("x", { id: "x" });
		socket.deliver(encodeDocFrame(MSG_DOC_UPDATE, "p1", [Y.encodeStateAsUpdate(other)]));
		expect(root.getMap("shapes").size).toBe(0);
		expect(page.getMap("shapes").size).toBe(1);
		// 購読していない doc 宛ては無視
		socket.deliver(encodeDocFrame(MSG_DOC_UPDATE, "p2", [Y.encodeStateAsUpdate(other)]));
		expect(root.getMap("shapes").size).toBe(0);
	});

	it("resubscribes after reconnecting", () => {
		vi.useFakeTimers();
		try {
			const { provider, socket } = setup();
			const page = new Y.Doc();
			provider.subscribeDoc("p1", page);
			socket.open();
			socket.close();
			// 切断中の編集は送れない
			page.getMap("shapes").set("offline", { id: "offline" });
			vi.advanceTimersByTime(60_000);
			const next = FakeSocket.instances[1];
			if (!next) throw new Error("no reconnect");
			next.open();
			const subscribe = next.docFrames().find((f) => f?.type === MSG_DOC_SUBSCRIBE);
			expect(subscribe?.docId).toBe("p1");
			expect([...(subscribe?.parts[0] ?? [])]).toEqual([...Y.encodeStateVector(page)]);
		} finally {
			vi.useRealTimers();
		}
	});

	it("unsubscribes and stops sending edits", () => {
		const { provider, socket } = setup();
		const page = new Y.Doc();
		const sub = provider.subscribeDoc("p1", page);
		socket.open();
		sub.unsubscribe();
		expect(
			socket.docFrames().some((f) => f?.type === MSG_DOC_UNSUBSCRIBE && f.docId === "p1"),
		).toBe(true);
		page.getMap("shapes").set("after", { id: "after" });
		expect(socket.docFrames().filter((f) => f?.type === MSG_DOC_UPDATE)).toHaveLength(0);
		// もう一度購読できる
		expect(() => provider.subscribeDoc("p1", page)).not.toThrow();
	});

	it("rejects a second subscription to the same id and invalid ids", () => {
		const { provider } = setup();
		provider.subscribeDoc("p1", new Y.Doc());
		expect(() => provider.subscribeDoc("p1", new Y.Doc())).toThrow();
		expect(() => provider.subscribeDoc("bad id", new Y.Doc())).toThrow();
	});
});
