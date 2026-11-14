import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
	createPage,
	deletePage,
	getPage,
	getPagesVersion,
	initPagedBoard,
	isPagedBoard,
	listPages,
	newPageId,
	observePages,
	renamePage,
	reorderPage,
	resolvePageId,
	restorePage,
	toPageMeta,
} from "../pages.js";
import { isValidDocId } from "../protocol.js";

describe("pages", () => {
	it("ページの無いボードはページ無しとして扱う", () => {
		const root = new Y.Doc();
		expect(getPagesVersion(root)).toBeNull();
		expect(listPages(root)).toEqual([]);
		expect(isPagedBoard(root)).toBe(false);
	});

	it("initPagedBoard で 1 枚目と版を 1 つの update で書く", () => {
		const root = new Y.Doc();
		let updates = 0;
		root.on("update", () => updates++);
		const page = initPagedBoard(root, { name: "ページ 1", id: "p1", now: 10 });
		expect(updates).toBe(1);
		expect(page).toEqual({ id: "p1", name: "ページ 1", order: expect.any(String), createdAt: 10 });
		expect(getPagesVersion(root)).toBe(1);
		expect(isPagedBoard(root)).toBe(true);
		// 2 回目は何もしない
		expect(initPagedBoard(root, { name: "x" }).id).toBe("p1");
		expect(listPages(root)).toHaveLength(1);
	});

	it("ルートにシェイプがあるボードは initPagedBoard せず移行を求める", () => {
		const root = new Y.Doc();
		root.getMap("shapes").set("s1", { id: "s1" });
		expect(() => initPagedBoard(root, { name: "x" })).toThrow(/migrate/);
		expect(getPagesVersion(root)).toBeNull();
	});

	it("createPage は末尾か指定ページの直後に足す", () => {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "A", id: "a" });
		createPage(root, { name: "C", id: "c" });
		createPage(root, { name: "B", id: "b", after: "a" });
		expect(listPages(root).map((p) => p.id)).toEqual(["a", "b", "c"]);
		expect(() => createPage(root, { name: "dup", id: "a" })).toThrow(/exists/);
		expect(() => createPage(root, { name: "bad", id: "a/b" })).toThrow(/Invalid/);
		expect(() => createPage(root, { name: "x", after: "nope" })).toThrow(/not found/);
	});

	it("削除済みは一覧から外し、getPage では読める", () => {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "A", id: "a" });
		createPage(root, { name: "B", id: "b" });
		const pages = root.getMap("pages");
		pages.set("b", { ...(pages.get("b") as object), deletedAt: 5 });
		expect(listPages(root).map((p) => p.id)).toEqual(["a"]);
		expect(listPages(root, { includeDeleted: true }).map((p) => p.id)).toEqual(["a", "b"]);
		expect(getPage(root, "b")?.deletedAt).toBe(5);
	});

	it("全ページが削除済みならページ無しとして扱う", () => {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "A", id: "a" });
		root.getMap("pages").set("a", { ...(root.getMap("pages").get("a") as object), deletedAt: 1 });
		expect(isPagedBoard(root)).toBe(false);
	});

	it("形の違うエントリは読み飛ばす", () => {
		expect(toPageMeta(null)).toBeNull();
		expect(toPageMeta({ id: "a" })).toBeNull();
		expect(toPageMeta({ id: "a b", order: "a0" })).toBeNull();
		expect(toPageMeta({ id: "a", order: "a0" })).toEqual({
			id: "a",
			name: "",
			order: "a0",
			createdAt: 0,
		});
		const root = new Y.Doc();
		root.getMap("pages").set("x", { id: "y", order: "a0" });
		expect(listPages(root)).toEqual([]);
	});

	it("resolvePageId は URL → 前回 → 先頭の順に選ぶ", () => {
		const pages = [
			{ id: "a", name: "A", order: "a0", createdAt: 0 },
			{ id: "b", name: "B", order: "a1", createdAt: 0 },
			{ id: "c", name: "C", order: "a2", createdAt: 0, deletedAt: 1 },
		];
		expect(resolvePageId(pages, { requested: "b", lastOpened: "a" })).toBe("b");
		expect(resolvePageId(pages, { requested: "zz", lastOpened: "b" })).toBe("b");
		expect(resolvePageId(pages, { requested: "c" })).toBe("a");
		expect(resolvePageId(pages, {})).toBe("a");
		expect(resolvePageId([], { requested: "a" })).toBeNull();
	});

	it("newPageId は doc id として使える", () => {
		const id = newPageId();
		expect(isValidDocId(id)).toBe(true);
		expect(newPageId()).not.toBe(id);
	});

	it("observePages はページと版の変化を知らせる", () => {
		const root = new Y.Doc();
		let calls = 0;
		const off = observePages(root, () => calls++);
		initPagedBoard(root, { name: "A" });
		expect(calls).toBeGreaterThan(0);
		const before = calls;
		off();
		createPage(root, { name: "B" });
		expect(calls).toBe(before);
	});
});

describe("ページの名前・並び・削除", () => {
	function board() {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "1", id: "p1" });
		createPage(root, { name: "2", id: "p2" });
		createPage(root, { name: "3", id: "p3" });
		return root;
	}
	const ids = (root: Y.Doc) => listPages(root).map((p) => p.id);

	it("名前を変える", () => {
		const root = board();
		renamePage(root, "p2", "二");
		expect(getPage(root, "p2")?.name).toBe("二");
		expect(() => renamePage(root, "zz", "x")).toThrow();
	});

	it("並び順を動かす（範囲外は端へ）", () => {
		const root = board();
		reorderPage(root, "p3", 0);
		expect(ids(root)).toEqual(["p3", "p1", "p2"]);
		reorderPage(root, "p3", 1);
		expect(ids(root)).toEqual(["p1", "p3", "p2"]);
		reorderPage(root, "p1", 99);
		expect(ids(root)).toEqual(["p3", "p2", "p1"]);
		reorderPage(root, "p1", -5);
		expect(ids(root)).toEqual(["p1", "p3", "p2"]);
	});

	it("削除は印だけで、戻せる。最後の 1 枚は消せない", () => {
		const root = board();
		deletePage(root, "p2", { now: 5 });
		expect(ids(root)).toEqual(["p1", "p3"]);
		expect(getPage(root, "p2")?.deletedAt).toBe(5);
		expect(() => deletePage(root, "p2")).toThrow();
		deletePage(root, "p3");
		expect(() => deletePage(root, "p1")).toThrow(/last page/);
		restorePage(root, "p2");
		expect(ids(root)).toEqual(["p1", "p2"]);
		expect(getPage(root, "p2")?.deletedAt).toBeUndefined();
	});
});
