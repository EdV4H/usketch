import {
	createPage,
	decodeDocFrame,
	initPagedBoard,
	MSG_DOC_UPDATE,
	MSG_YJS_UPDATE,
} from "@edv4h/usketch-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { handleAiPlaceShapes, handleAiUpdateShapes } from "../ai-handler.js";
import { createBoardShapes, PageNotFoundError } from "../board-shapes.js";
import { createPageDocs, type PageDocSocket } from "../page-docs.js";
import { handleThumbnail } from "../thumbnail-handler.js";

/** Minimal in-memory stand-in for DurableObjectStorage. */
function fakeStorage() {
	const map = new Map<string, unknown>();
	return {
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
}

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
}

function setup() {
	const root = new Y.Doc();
	const sockets: FakeSocket[] = [];
	const rootPublished: Uint8Array[] = [];
	const pageDocs = createPageDocs({ storage: fakeStorage(), getSockets: () => sockets });
	const shapes = createBoardShapes({
		getRootDoc: async () => ({ doc: root }),
		publishRoot: (u) => rootPublished.push(u),
		pageDocs,
	});
	return { root, sockets, rootPublished, pageDocs, shapes };
}

function postJson(body: unknown): Request {
	return new Request("http://do/x", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

const rect = { type: "rectangle", x: 0, y: 0, width: 100, height: 50 };

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("createBoardShapes", () => {
	it("ページを使わないボードはルート doc を開く", async () => {
		const { root, shapes } = setup();
		const target = await shapes.open(null);
		expect(target.pageId).toBeNull();
		expect(target.doc).toBe(root);
		await expect(shapes.open("p1")).rejects.toBeInstanceOf(PageNotFoundError);
	});

	it("ページを使うボードは先頭ページか指定したページのページ doc を開く", async () => {
		const { root, shapes } = setup();
		initPagedBoard(root, { name: "1", id: "p1" });
		createPage(root, { name: "2", id: "p2" });
		const first = await shapes.open(null);
		expect(first.pageId).toBe("p1");
		expect(first.doc).not.toBe(root);
		const second = await shapes.open("p2");
		expect(second.pageId).toBe("p2");
		await expect(shapes.open("nope")).rejects.toBeInstanceOf(PageNotFoundError);
		await expect(shapes.open("../x")).rejects.toBeInstanceOf(PageNotFoundError);
	});

	it("誰も購読していないページ doc は release で外れる（書いていなければすぐ）", async () => {
		const { root, shapes, pageDocs } = setup();
		initPagedBoard(root, { name: "1", id: "p1" });
		const target = await shapes.open(null);
		expect(pageDocs.loadedDocIds()).toEqual(["p1"]);
		target.release();
		expect(pageDocs.loadedDocIds()).toEqual([]);
	});
});

describe("AI handler とページ", () => {
	it("ページ無しのボードではルートの shapes に置き、ルートとして広める", async () => {
		const { root, rootPublished, shapes } = setup();
		const res = await handleAiPlaceShapes(postJson({ shapes: [rect] }), {
			openShapes: (p) => shapes.open(p),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { pageId: string | null; placedShapes: { id: string }[] };
		expect(body.pageId).toBeNull();
		expect(root.getMap("shapes").has(body.placedShapes[0].id)).toBe(true);
		expect(rootPublished.length).toBeGreaterThan(0);
	});

	it("指定したページの doc に置き、そのページの購読者にだけ DOC_UPDATE を送る", async () => {
		const { root, rootPublished, sockets, pageDocs, shapes } = setup();
		initPagedBoard(root, { name: "1", id: "p1" });
		createPage(root, { name: "2", id: "p2" });
		const onP2 = new FakeSocket();
		const onP1 = new FakeSocket();
		sockets.push(onP2, onP1);
		await pageDocs.handleSubscribe(onP2, "p2", undefined);
		await pageDocs.handleSubscribe(onP1, "p1", undefined);
		onP2.received = [];
		onP1.received = [];

		const res = await handleAiPlaceShapes(postJson({ shapes: [rect], pageId: "p2" }), {
			openShapes: (p) => shapes.open(p),
		});
		const body = (await res.json()) as { pageId: string; placedShapes: { id: string }[] };
		expect(body.pageId).toBe("p2");
		const id = body.placedShapes[0].id;

		const p2 = await (await pageDocs.load("p2")).getOrCreateDoc();
		expect(p2.doc.getMap("shapes").has(id)).toBe(true);
		expect(root.getMap("shapes").size).toBe(0);
		expect(rootPublished).toEqual([]);

		const frames = onP2.received.map((d) => decodeDocFrame(d));
		expect(frames.some((f) => f?.type === MSG_DOC_UPDATE && f.docId === "p2")).toBe(true);
		expect(onP1.received).toEqual([]);
		// ルート用の YJS_UPDATE は送らない
		expect(onP2.received.some((d) => d[0] === MSG_YJS_UPDATE)).toBe(false);

		// 更新も同じページに書く
		const upd = await handleAiUpdateShapes(postJson({ updates: [{ id, x: 42 }], pageId: "p2" }), {
			openShapes: (p) => shapes.open(p),
		});
		expect(upd.status).toBe(200);
		expect((p2.doc.getMap("shapes").get(id) as { x: number }).x).toBe(42);
	});

	it("無いページを指定したら 404", async () => {
		const { root, shapes } = setup();
		initPagedBoard(root, { name: "1", id: "p1" });
		const res = await handleAiPlaceShapes(postJson({ shapes: [rect], pageId: "gone" }), {
			openShapes: (p) => shapes.open(p),
		});
		expect(res.status).toBe(404);
	});

	it("書いたページ doc は保存が済んだら外れる", async () => {
		const { root, pageDocs, shapes } = setup();
		initPagedBoard(root, { name: "1", id: "p1" });
		await handleAiPlaceShapes(postJson({ shapes: [rect] }), { openShapes: (p) => shapes.open(p) });
		expect(pageDocs.loadedDocIds()).toEqual(["p1"]);
		await vi.advanceTimersByTimeAsync(5000);
		expect(pageDocs.loadedDocIds()).toEqual([]);
		// 保存されているので読み直せる
		const again = await (await pageDocs.load("p1")).getOrCreateDoc();
		expect(again.doc.getMap("shapes").size).toBe(1);
	});
});

describe("サムネイルとページ", () => {
	it("?page= のページ（省略時は先頭ページ）を描く", async () => {
		const { root, pageDocs, shapes } = setup();
		initPagedBoard(root, { name: "1", id: "p1" });
		createPage(root, { name: "2", id: "p2" });
		const p2 = await (await pageDocs.load("p2")).getOrCreateDoc();
		p2.doc.getMap("shapes").set("s", { id: "s", type: "rect", x: 0, y: 0, width: 10, height: 10 });

		const open = (p: string | null) => shapes.open(p);
		const first = await (await handleThumbnail(new URL("http://do/thumbnail"), open)).text();
		const second = await (
			await handleThumbnail(new URL("http://do/thumbnail?page=p2"), open)
		).text();
		expect(first).not.toBe(second);
		expect(second).toContain("<rect");
	});
});
