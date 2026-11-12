import {
	decodeDocFrame,
	encodeDocFrame,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_SYNC,
	MSG_DOC_UNSUBSCRIBE,
	MSG_DOC_UPDATE,
} from "@edv4h/usketch-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { PageSubscriptions } from "../page-subscriptions.js";

/** board-room の page-docs と同じ返事をする、ページ doc を持った偽サーバー。 */
function fakeServer() {
	const docs = new Map<string, Y.Doc>();
	const sent: Array<{ type: number; docId: string }> = [];
	let client: PageSubscriptions | null = null;
	let online = true;
	/** 返事を返さないページ（読み込み失敗のふり）。 */
	const silent = new Set<string>();
	const docOf = (id: string) => {
		let doc = docs.get(id);
		if (!doc) {
			doc = new Y.Doc();
			docs.set(id, doc);
		}
		return doc;
	};
	const send = (data: Uint8Array): boolean => {
		if (!online) return false;
		const frame = decodeDocFrame(data);
		if (!frame) throw new Error("bad frame");
		sent.push({ type: frame.type, docId: frame.docId });
		if (frame.type === MSG_DOC_SUBSCRIBE && !silent.has(frame.docId)) {
			const doc = docOf(frame.docId);
			const diff = Y.encodeStateAsUpdate(doc, frame.parts[0]);
			queueMicrotask(() =>
				client?.handleFrame(
					encodeDocFrame(MSG_DOC_SYNC, frame.docId, [diff, Y.encodeStateVector(doc)]),
				),
			);
		} else if (frame.type === MSG_DOC_UPDATE) {
			Y.applyUpdate(docOf(frame.docId), frame.parts[0]);
		}
		return true;
	};
	return {
		docs,
		docOf,
		sent,
		silent,
		send,
		attach: (c: PageSubscriptions) => {
			client = c;
		},
		setOnline: (v: boolean) => {
			online = v;
		},
		push: (docId: string, update: Uint8Array) =>
			client?.handleFrame(encodeDocFrame(MSG_DOC_UPDATE, docId, [update])),
	};
}

function setup(options: { maxOpen?: number; syncTimeoutMs?: number } = {}) {
	const server = fakeServer();
	const pages = new PageSubscriptions({ send: server.send, ...options });
	server.attach(pages);
	return { server, pages };
}

describe("PageSubscriptions", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("購読してサーバーの中身を受け取ってから返す", async () => {
		const { server, pages } = setup();
		server.docOf("p1").getMap("shapes").set("a", { id: "a" });
		const doc = await pages.open("p1");
		expect(doc.getMap("shapes").get("a")).toEqual({ id: "a" });
		expect(doc.guid).toBe("page:p1");
		expect(server.sent).toEqual([{ type: MSG_DOC_SUBSCRIBE, docId: "p1" }]);
		// 2 回目は購読し直さない
		expect(await pages.open("p1")).toBe(doc);
		expect(server.sent).toHaveLength(1);
	});

	it("書いた変更を DOC_UPDATE で送り、サーバーからの更新を適用する", async () => {
		const { server, pages } = setup();
		const doc = await pages.open("p1");
		doc.getMap("shapes").set("b", { id: "b" });
		expect(server.docOf("p1").getMap("shapes").get("b")).toEqual({ id: "b" });

		const other = new Y.Doc();
		Y.applyUpdate(other, Y.encodeStateAsUpdate(server.docOf("p1")));
		const before = Y.encodeStateVector(other);
		other.getMap("shapes").set("c", { id: "c" });
		const sentBefore = server.sent.length;
		server.push("p1", Y.encodeStateAsUpdate(other, before));
		expect(doc.getMap("shapes").get("c")).toEqual({ id: "c" });
		// 受け取った更新は送り返さない
		expect(server.sent.length).toBe(sentBefore);
	});

	it("決めた枚数を超えたら古いページから購読をやめる", async () => {
		const { server, pages } = setup({ maxOpen: 2 });
		await pages.open("p1");
		await pages.open("p2");
		await pages.open("p1"); // p1 を新しくする
		await pages.open("p3");
		expect(pages.openPageIds()).toEqual(["p1", "p3"]);
		expect(server.sent).toContainEqual({ type: MSG_DOC_UNSUBSCRIBE, docId: "p2" });
	});

	it("返事が無ければ時間切れで失敗し、そのページは持たない", async () => {
		const { server, pages } = setup({ syncTimeoutMs: 100 });
		server.silent.add("p1");
		const opening = pages.open("p1");
		const assertion = expect(opening).rejects.toThrow(/Timed out/);
		await vi.advanceTimersByTimeAsync(100);
		await assertion;
		expect(pages.openPageIds()).toEqual([]);
	});

	it("つながり直したら購読し直し、切れている間の編集を送り返す", async () => {
		const { server, pages } = setup();
		const doc = await pages.open("p1");
		server.setOnline(false);
		doc.getMap("shapes").set("offline", { id: "offline" });
		expect(server.docOf("p1").getMap("shapes").has("offline")).toBe(false);

		server.setOnline(true);
		pages.resubscribeAll();
		await vi.advanceTimersByTimeAsync(0);
		expect(server.docOf("p1").getMap("shapes").get("offline")).toEqual({ id: "offline" });
	});

	it("ページ doc 宛てでないフレームは扱わない", () => {
		const { pages } = setup();
		expect(pages.handleFrame(new Uint8Array([2, 0, 0]))).toBe(false);
		expect(pages.handleFrame(encodeDocFrame(MSG_DOC_UPDATE, "unknown", [new Uint8Array()]))).toBe(
			true,
		);
	});
});
