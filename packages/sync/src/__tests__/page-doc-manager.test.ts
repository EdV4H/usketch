import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createPageDocManager, type PageDocPersistence } from "../page-doc-manager.js";
import type { DocSubscription } from "../ws-provider.js";

/** subscribeDoc だけを持つ provider の代わり。同期は手で起こす。 */
function fakeProvider() {
	const subs = new Map<string, { doc: Y.Doc; synced: () => void; unsubscribed: boolean }>();
	return {
		subs,
		subscribeDoc(docId: string, doc: Y.Doc): DocSubscription {
			if (subs.has(docId) && !subs.get(docId)?.unsubscribed) throw new Error("dup");
			let synced = () => {};
			const whenSynced = new Promise<void>((resolve) => {
				synced = resolve;
			});
			const entry = { doc, synced, unsubscribed: false };
			subs.set(docId, entry);
			return {
				docId,
				whenSynced,
				unsubscribe() {
					entry.unsubscribed = true;
				},
			};
		},
	};
}

/** 手元保存の代わり。saved に入っている update を読み込む。 */
function fakePersist(saved: Record<string, Uint8Array> = {}) {
	const destroyed: string[] = [];
	const persist = (pageId: string, doc: Y.Doc): PageDocPersistence => ({
		whenSynced: Promise.resolve().then(() => {
			const update = saved[pageId];
			if (update) Y.applyUpdate(doc, update);
		}),
		destroy: () => destroyed.push(pageId),
	});
	return { persist, destroyed };
}

function docWithShape(id: string): Uint8Array {
	const doc = new Y.Doc();
	doc.getMap("shapes").set(id, { id });
	return Y.encodeStateAsUpdate(doc);
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe("createPageDocManager", () => {
	it("ページごとに guid 付きの doc を作り、手元保存とサーバー購読を張る", async () => {
		const provider = fakeProvider();
		const { persist } = fakePersist({ p1: docWithShape("s1") });
		const manager = createPageDocManager({ provider, persist });
		const handle = manager.open("p1");
		expect(handle.doc.guid).toBe("page:p1");
		expect(provider.subs.get("p1")?.doc).toBe(handle.doc);
		// 手元に中身があればサーバーを待たずに読み込み完了
		await handle.whenLoaded;
		expect(handle.doc.getMap("shapes").has("s1")).toBe(true);
	});

	it("手元が空ならサーバーとの同期を待つ", async () => {
		const provider = fakeProvider();
		const manager = createPageDocManager({ provider, persist: fakePersist().persist });
		const handle = manager.open("p1");
		let loaded = false;
		handle.whenLoaded.then(() => {
			loaded = true;
		});
		await vi.advanceTimersByTimeAsync(100);
		expect(loaded).toBe(false);
		provider.subs.get("p1")?.synced();
		await vi.advanceTimersByTimeAsync(0);
		expect(loaded).toBe(true);
	});

	it("サーバーが応えなくても上限時間で開く（オフライン）", async () => {
		const provider = fakeProvider();
		const manager = createPageDocManager({ provider, serverSyncTimeoutMs: 500 });
		const handle = manager.open("p1");
		let loaded = false;
		handle.whenLoaded.then(() => {
			loaded = true;
		});
		await vi.advanceTimersByTimeAsync(499);
		expect(loaded).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(loaded).toBe(true);
	});

	it("provider が無い（ローカルボード）なら手元保存だけで開く", async () => {
		const manager = createPageDocManager({ persist: fakePersist().persist });
		await manager.open("p1").whenLoaded;
	});

	it("同じページを開くと同じ doc を返す", () => {
		const manager = createPageDocManager();
		const a = manager.open("p1");
		const b = manager.open("p1");
		expect(a.doc).toBe(b.doc);
	});

	it("閉じたページは keep 枚まで残し、超えたら古いものから外す", () => {
		const provider = fakeProvider();
		const { persist, destroyed } = fakePersist();
		const manager = createPageDocManager({ provider, persist, keep: 2 });
		const p1 = manager.open("p1");
		p1.release();
		const p2 = manager.open("p2");
		p2.release();
		expect(manager.loadedPageIds()).toEqual(["p1", "p2"]);
		const p3 = manager.open("p3");
		expect(manager.loadedPageIds()).toEqual(["p2", "p3"]);
		expect(provider.subs.get("p1")?.unsubscribed).toBe(true);
		expect(destroyed).toEqual(["p1"]);
		expect(p1.doc.isDestroyed).toBe(true);
		// 残っているページを開き直すと同じ doc
		const again = manager.open("p2");
		expect(again.doc).toBe(p2.doc);
		expect(manager.loadedPageIds()).toEqual(["p3", "p2"]);
		p3.release();
		again.release();
	});

	it("開いているページは keep を超えても外さない", () => {
		const manager = createPageDocManager({ keep: 1 });
		const p1 = manager.open("p1");
		const p2 = manager.open("p2");
		expect(manager.loadedPageIds()).toEqual(["p1", "p2"]);
		p1.release();
		expect(manager.loadedPageIds()).toEqual(["p2"]);
		p2.release();
		expect(manager.loadedPageIds()).toEqual(["p2"]);
	});

	it("release を二重に呼んでも参照数は 1 つだけ減る", () => {
		const manager = createPageDocManager({ keep: 0 });
		const a = manager.open("p1");
		const b = manager.open("p1");
		a.release();
		a.release();
		expect(manager.loadedPageIds()).toEqual(["p1"]);
		b.release();
		expect(manager.loadedPageIds()).toEqual([]);
	});

	it("destroy で全部外し、その後は開けない", () => {
		const provider = fakeProvider();
		const { persist, destroyed } = fakePersist();
		const manager = createPageDocManager({ provider, persist });
		const p1 = manager.open("p1");
		manager.open("p2");
		manager.destroy();
		expect(destroyed.sort()).toEqual(["p1", "p2"]);
		expect(p1.doc.isDestroyed).toBe(true);
		expect(provider.subs.get("p2")?.unsubscribed).toBe(true);
		expect(() => manager.open("p3")).toThrow(/destroyed/);
	});
});
