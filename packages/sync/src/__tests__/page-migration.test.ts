import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
	checkPagesMigration,
	copyRootShapesToPage,
	countRootShapes,
	finishPagesMigration,
	moveRootShapesToPage,
	needsPagesMigration,
} from "../page-migration.js";
import { getLegacyPageId, isPagedBoard, listPages } from "../pages.js";

function rootWith(ids: string[]): Y.Doc {
	const root = new Y.Doc();
	const shapes = root.getMap("shapes");
	for (const [i, id] of ids.entries()) shapes.set(id, { id, type: "rect", x: i, style: { a: 1 } });
	return root;
}

function migrate(root: Y.Doc, pageDoc = new Y.Doc()) {
	copyRootShapesToPage(root, pageDoc);
	const result = finishPagesMigration(root, pageDoc, { pageId: "p1", now: 1 });
	return { pageDoc, result };
}

describe("page migration", () => {
	it("ルートのシェイプを 1 枚目へ移し、版と移行先を書く", () => {
		const root = rootWith(["a", "b"]);
		const before = root.getMap("shapes").toJSON();
		expect(needsPagesMigration(root)).toBe(true);
		const { pageDoc, result } = migrate(root);
		expect(result.removed).toBe(2);
		expect(result.leftInRoot).toEqual([]);
		expect(result.page).toMatchObject({ id: "p1", name: "ページ 1", createdAt: 1 });
		expect(isPagedBoard(root)).toBe(true);
		expect(needsPagesMigration(root)).toBe(false);
		expect(getLegacyPageId(root)).toBe("p1");
		expect(listPages(root).map((p) => p.id)).toEqual(["p1"]);
		expect(pageDoc.getMap("shapes").toJSON()).toEqual(before);
		expect(checkPagesMigration(before, root, pageDoc)).toEqual({
			ok: true,
			missing: [],
			changed: [],
			rootShapes: 0,
			pageShapes: 2,
		});
	});

	it("空のボードも 1 枚目のページだけを作って移行できる", () => {
		const root = new Y.Doc();
		const { result } = migrate(root);
		expect(result.removed).toBe(0);
		expect(isPagedBoard(root)).toBe(true);
	});

	it("写した後に書き換わったシェイプはルートに残し、後から移せる", () => {
		const root = rootWith(["a", "b"]);
		const pageDoc = new Y.Doc();
		copyRootShapesToPage(root, pageDoc);
		root.getMap("shapes").set("b", { id: "b", type: "rect", x: 99 });
		root.getMap("shapes").set("c", { id: "c", type: "rect", x: 3 });
		const result = finishPagesMigration(root, pageDoc, { pageId: "p1" });
		expect(result.removed).toBe(1);
		expect(result.leftInRoot.sort()).toEqual(["b", "c"]);
		expect(countRootShapes(root)).toBe(2);

		const move = moveRootShapesToPage(root, pageDoc);
		expect(move?.ids.sort()).toEqual(["b", "c"]);
		expect(move?.removeFromRoot()).toBe(2);
		expect(countRootShapes(root)).toBe(0);
		expect(pageDoc.getMap("shapes").get("b")).toEqual({ id: "b", type: "rect", x: 99 });
		expect(moveRootShapesToPage(root, pageDoc)).toBeNull();
	});

	it("移す途中でまた書き換わったシェイプは消さない", () => {
		const root = rootWith([]);
		migrate(root);
		const pageDoc = new Y.Doc();
		root.getMap("shapes").set("x", { id: "x", v: 1 });
		const move = moveRootShapesToPage(root, pageDoc);
		root.getMap("shapes").set("x", { id: "x", v: 2 });
		expect(move?.removeFromRoot()).toBe(0);
		expect(countRootShapes(root)).toBe(1);
		// 次の呼び出しで新しい値が移る
		moveRootShapesToPage(root, pageDoc)?.removeFromRoot();
		expect(pageDoc.getMap("shapes").get("x")).toEqual({ id: "x", v: 2 });
		expect(countRootShapes(root)).toBe(0);
	});

	it("途中で止まっても、やり直せば同じ結果になる", () => {
		const root = rootWith(["a"]);
		const pageDoc = new Y.Doc();
		copyRootShapesToPage(root, pageDoc);
		copyRootShapesToPage(root, pageDoc); // 2 回目
		finishPagesMigration(root, pageDoc, { pageId: "p1" });
		expect(() => finishPagesMigration(root, pageDoc, { pageId: "p1" })).toThrow();
		expect(pageDoc.getMap("shapes").size).toBe(1);
	});

	it("check は欠け・違い・ルートの残りを知らせる", () => {
		const root = rootWith(["a", "b"]);
		const before = root.getMap("shapes").toJSON();
		const pageDoc = new Y.Doc();
		copyRootShapesToPage(root, pageDoc);
		finishPagesMigration(root, pageDoc, { pageId: "p1" });
		pageDoc.getMap("shapes").delete("a");
		pageDoc.getMap("shapes").set("b", { id: "b", changed: true });
		root.getMap("shapes").set("z", { id: "z" });
		expect(checkPagesMigration(before, root, pageDoc)).toMatchObject({
			ok: false,
			missing: ["a"],
			changed: ["b"],
			rootShapes: 1,
		});
	});

	it("別々の doc でも、Yjs の update を介して同じ結果になる", () => {
		const root = rootWith(["a"]);
		const { pageDoc } = migrate(root);
		const remoteRoot = new Y.Doc();
		const remotePage = new Y.Doc();
		Y.applyUpdate(remoteRoot, Y.encodeStateAsUpdate(root));
		Y.applyUpdate(remotePage, Y.encodeStateAsUpdate(pageDoc));
		expect(isPagedBoard(remoteRoot)).toBe(true);
		expect(remoteRoot.getMap("shapes").size).toBe(0);
		expect(remotePage.getMap("shapes").has("a")).toBe(true);
	});
});
