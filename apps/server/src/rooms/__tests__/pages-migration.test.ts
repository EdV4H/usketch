import {
	decodeDocFrame,
	getLegacyPageId,
	isPagedBoard,
	listPages,
	MSG_DOC_UPDATE,
} from "@edv4h/usketch-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createPageDocs, type PageDocSocket } from "../page-docs.js";
import { createPagesMigration, PENDING_MIGRATION_KEY } from "../pages-migration.js";
import { createYjsSync } from "../yjs-sync.js";

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
	};
	return { map, storage: storage as unknown as DurableObjectStorage };
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

/** ルート doc に保存済みの状態を用意する（移行前のボード）。 */
async function seedRoot(storage: DurableObjectStorage, ids: string[]) {
	const seed = createYjsSync({ storage });
	const { doc } = await seed.getOrCreateDoc();
	const updates: Uint8Array[] = [];
	doc.on("update", (u: Uint8Array) => updates.push(u));
	for (const id of ids) doc.getMap("shapes").set(id, { id, type: "rect", x: 0 });
	for (const u of updates) seed.pushUpdate(u);
	await seed.save();
}

function setup(storage: DurableObjectStorage, options: { enabled?: boolean } = {}) {
	const sockets: FakeSocket[] = [];
	const root = createYjsSync({ storage });
	const pageDocs = createPageDocs({ storage, getSockets: () => sockets });
	const broadcasts: Uint8Array[] = [];
	const commit = vi.fn(async () => null);
	const migration = createPagesMigration({
		enabled: options.enabled ?? true,
		storage,
		root,
		pageDocs,
		broadcastRoot: (u) => broadcasts.push(u),
		commitBeforeMigration: commit,
		now: () => 1,
	});
	return { sockets, root, pageDocs, broadcasts, commit, migration };
}

/** 保存済みのページ doc を読み直す（メモリに残っているものではなく storage から）。 */
async function readSavedPage(storage: DurableObjectStorage, pageId: string) {
	const pageDocs = createPageDocs({ storage, getSockets: () => [] });
	return (await (await pageDocs.load(pageId)).getOrCreateDoc()).doc;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createPagesMigration", () => {
	it("フラグが閉じていれば何もしない", async () => {
		const { storage } = fakeStorage();
		await seedRoot(storage, ["a"]);
		const { root, migration, commit } = setup(storage, { enabled: false });
		await migration.ensureMigrated();
		const { doc } = await root.getOrCreateDoc();
		expect(isPagedBoard(doc)).toBe(false);
		expect(doc.getMap("shapes").size).toBe(1);
		expect(commit).not.toHaveBeenCalled();
	});

	it("ルートの shapes を 1 枚目のページへ移し、保存して広める", async () => {
		const { storage, map } = fakeStorage();
		await seedRoot(storage, ["a", "b"]);
		const { root, migration, commit, broadcasts, pageDocs } = setup(storage);
		await migration.ensureMigrated();

		const { doc } = await root.getOrCreateDoc();
		expect(isPagedBoard(doc)).toBe(true);
		expect(doc.getMap("shapes").size).toBe(0);
		const pageId = getLegacyPageId(doc) as string;
		expect(listPages(doc).map((p) => p.id)).toEqual([pageId]);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(map.has(PENDING_MIGRATION_KEY)).toBe(false);
		expect(broadcasts).toHaveLength(1);
		// 誰も購読していないページ doc は、予約していた保存が済むとメモリから外れる
		await vi.advanceTimersByTimeAsync(5000);
		expect(pageDocs.loadedDocIds()).toEqual([]);

		// どちらも保存されている（読み直しても同じ）
		const page = await readSavedPage(storage, pageId);
		expect(Object.keys(page.getMap("shapes").toJSON()).sort()).toEqual(["a", "b"]);
		const reloaded = (await createYjsSync({ storage }).getOrCreateDoc()).doc;
		expect(isPagedBoard(reloaded)).toBe(true);
		expect(reloaded.getMap("shapes").size).toBe(0);

		// 2 回目は何もしない
		await migration.ensureMigrated();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it("空のボードは 1 枚目だけ作る", async () => {
		const { storage } = fakeStorage();
		const { root, migration } = setup(storage);
		await migration.ensureMigrated();
		const { doc } = await root.getOrCreateDoc();
		expect(listPages(doc)).toHaveLength(1);
	});

	it("同時に呼ばれても 1 回だけ移行する", async () => {
		const { storage } = fakeStorage();
		await seedRoot(storage, ["a"]);
		const { root, migration, commit } = setup(storage);
		await Promise.all([migration.ensureMigrated(), migration.ensureMigrated()]);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(listPages((await root.getOrCreateDoc()).doc)).toHaveLength(1);
	});

	it("途中で止まった移行は同じページへやり直す", async () => {
		const { storage } = fakeStorage();
		await seedRoot(storage, ["a"]);
		await storage.put(PENDING_MIGRATION_KEY, "pending1");
		const { root, migration } = setup(storage);
		await migration.ensureMigrated();
		const { doc } = await root.getOrCreateDoc();
		expect(getLegacyPageId(doc)).toBe("pending1");
		expect((await readSavedPage(storage, "pending1")).getMap("shapes").has("a")).toBe(true);
	});

	it("移行後にルートへ書かれたシェイプは 1 枚目へ移り、そのページの購読者に届く", async () => {
		const { storage } = fakeStorage();
		await seedRoot(storage, ["a"]);
		const { root, migration, pageDocs, sockets, broadcasts } = setup(storage);
		await migration.ensureMigrated();
		const { doc } = await root.getOrCreateDoc();
		const pageId = getLegacyPageId(doc) as string;
		const viewer = new FakeSocket();
		sockets.push(viewer);
		await pageDocs.handleSubscribe(viewer, pageId, undefined);
		viewer.received = [];

		// 古いクライアントの書き込み（ルートの shapes）
		const old = new Y.Doc();
		Y.applyUpdate(old, Y.encodeStateAsUpdate(doc));
		const sv = Y.encodeStateVector(old);
		old.getMap("shapes").set("late", { id: "late", type: "rect" });
		const update = Y.encodeStateAsUpdate(old, sv);
		await root.applyClientUpdate(update);
		root.pushUpdate(update);
		broadcasts.length = 0;

		await migration.moveRootShapes();
		expect(doc.getMap("shapes").size).toBe(0);
		expect(broadcasts).toHaveLength(1);
		const frames = viewer.received.map((d) => decodeDocFrame(d));
		expect(frames.some((f) => f?.type === MSG_DOC_UPDATE && f.docId === pageId)).toBe(true);
		expect((await readSavedPage(storage, pageId)).getMap("shapes").has("late")).toBe(true);

		// 移すものが無ければ何もしない
		broadcasts.length = 0;
		await migration.moveRootShapes();
		expect(broadcasts).toHaveLength(0);
	});

	it("フラグが閉じていても、ページを使うボードのルートへの書き込みは移す", async () => {
		const { storage } = fakeStorage();
		await seedRoot(storage, ["a"]);
		await setup(storage).migration.ensureMigrated();
		await vi.advanceTimersByTimeAsync(6000);

		const { root, migration } = setup(storage, { enabled: false });
		const { doc } = await root.getOrCreateDoc();
		doc.getMap("shapes").set("late", { id: "late" });
		await migration.moveRootShapes();
		expect(doc.getMap("shapes").size).toBe(0);
	});
});
