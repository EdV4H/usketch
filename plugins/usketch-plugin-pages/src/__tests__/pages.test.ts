import { initPagedBoard, listPages, type PageDocHandle } from "@edv4h/usketch-sync";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createPagesApi } from "../pages-api.js";
import { copyPageContent, nextPageName } from "../pages-ops.js";

function board() {
	const root = new Y.Doc();
	initPagedBoard(root, { name: "ページ 1", id: "p1" });
	const docs = new Map<string, Y.Doc>();
	const released: string[] = [];
	const openPageDoc = (pageId: string): PageDocHandle => {
		let doc = docs.get(pageId);
		if (!doc) {
			doc = new Y.Doc();
			docs.set(pageId, doc);
		}
		return { pageId, doc, whenLoaded: Promise.resolve(), release: () => released.push(pageId) };
	};
	return { root, docs, released, openPageDoc };
}

const names = (root: Y.Doc) => listPages(root).map((p) => p.name);

describe("createPagesApi", () => {
	it("見え方（view）: 見られないページを隠し、本当の名前を出し、名前の変更を任せる", () => {
		const { root } = board();
		const setup = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} });
		const secret = setup.create({ name: "" });
		const third = setup.create({ name: "ページ 3", after: secret.id });
		let hidden = new Set([secret.id]);
		const listeners = new Set<() => void>();
		const renamed: string[] = [];
		const switchPage = vi.fn();
		const api = createPagesApi({
			root,
			currentPageId: "p1",
			switchPage,
			view: {
				isVisible: (id) => !hidden.has(id),
				displayName: (page) => (page.id === secret.id ? "ひみつ" : undefined),
				rename(pageId, name) {
					if (pageId !== secret.id) return false;
					renamed.push(name);
					return true;
				},
				subscribe(listener) {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			},
		});
		expect(api.list().map((p) => p.name)).toEqual(["ページ 1", "ページ 3"]);
		// 隣は見えるページで数える
		api.go(1);
		expect(switchPage).toHaveBeenCalledWith(third.id);
		// 見え方が変わったら購読者に届く
		const listener = vi.fn();
		const off = api.subscribe(listener);
		hidden = new Set();
		for (const l of listeners) l();
		expect(listener).toHaveBeenCalled();
		off();
		expect(api.list().map((p) => p.name)).toEqual(["ページ 1", "ひみつ", "ページ 3"]);
		// 伏せたページの名前変更はホストへ。ルート doc の名前は空のまま
		expect(api.rename(secret.id, "新しい名前").name).toBe("新しい名前");
		expect(renamed).toEqual(["新しい名前"]);
		expect(listPages(root).find((p) => p.id === secret.id)?.name).toBe("");
		// それ以外はルート doc の名前を変える
		api.rename(third.id, "ページ C");
		expect(listPages(root).find((p) => p.id === third.id)?.name).toBe("ページ C");
	});

	it("追加は今のページの直後に「ページ N」で足し、open で移る", () => {
		const { root } = board();
		const switchPage = vi.fn();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage });
		const second = api.create();
		expect(second.name).toBe("ページ 2");
		expect(switchPage).not.toHaveBeenCalled();
		const inserted = api.create({ open: true });
		expect(switchPage).toHaveBeenCalledWith(inserted.id);
		// 今のページ（p1）の直後に入る
		expect(names(root)).toEqual(["ページ 1", "ページ 3", "ページ 2"]);
	});

	it("名前変更・並べ替え・前後への移動", () => {
		const { root } = board();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} });
		const b = api.create({ name: "B", after: null });
		api.create({ name: "C", after: null });
		api.rename("p1", "  ");
		expect(names(root)).toEqual(["ページ", "B", "C"]);
		api.move(b.id, 1);
		expect(names(root)).toEqual(["ページ", "C", "B"]);
		api.reorder(b.id, 0);
		expect(names(root)).toEqual(["B", "ページ", "C"]);
	});

	it("次・前のページへ移る（端では移らない）", () => {
		const { root } = board();
		const switchPage = vi.fn();
		const p2 = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} }).create();
		const first = createPagesApi({ root, currentPageId: "p1", switchPage });
		expect(first.go(-1)).toBe(false);
		expect(first.go(1)).toBe(true);
		expect(switchPage).toHaveBeenLastCalledWith(p2.id);
	});

	it("削除は戻せ、今のページなら隣へ移る。最後の 1 枚は消せない", () => {
		const { root } = board();
		const switchPage = vi.fn();
		const p2 = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} }).create();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage, now: () => 7 });
		expect(api.canDelete("p1")).toBe(true);
		api.delete("p1");
		expect(switchPage).toHaveBeenCalledWith(p2.id);
		expect(api.list().map((p) => p.id)).toEqual([p2.id]);
		expect(api.listDeleted().map((p) => [p.id, p.deletedAt])).toEqual([["p1", 7]]);
		expect(api.canDelete(p2.id)).toBe(false);
		expect(() => api.delete(p2.id)).toThrow();
		api.restore("p1");
		expect(api.list().map((p) => p.id)).toEqual(["p1", p2.id]);
	});

	it("複製は直後に「のコピー」を足し、中身を新しい id で写す", async () => {
		const { root, docs, released, openPageDoc } = board();
		const source = openPageDoc("p1").doc.getMap("shapes");
		source.set("frame", { id: "frame", type: "frame", x: 0, y: 0, width: 10, height: 10 });
		source.set("child", {
			id: "child",
			type: "rect",
			x: 1,
			y: 1,
			width: 1,
			height: 1,
			parentId: "frame",
		});
		const switchPage = vi.fn();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage, openPageDoc });
		expect(api.canDuplicate).toBe(true);
		const copy = await api.duplicate("p1", { open: true });
		expect(names(root)).toEqual(["ページ 1", "ページ 1 のコピー"]);
		expect(switchPage).toHaveBeenCalledWith(copy.id);
		const copied = [
			...(docs.get(copy.id)?.getMap<Record<string, unknown>>("shapes").values() ?? []),
		];
		expect(copied).toHaveLength(2);
		const frame = copied.find((s) => s.type === "frame");
		const child = copied.find((s) => s.type === "rect");
		expect(frame?.id).not.toBe("frame");
		expect(child?.parentId).toBe(frame?.id);
		expect(released.sort()).toEqual([copy.id, "p1"].sort());
	});

	it("openPageDoc が無ければ複製はできない", async () => {
		const { root } = board();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} });
		expect(api.canDuplicate).toBe(false);
		await expect(api.duplicate("p1")).rejects.toThrow();
	});

	it("subscribe でページ一覧の変化が届く", () => {
		const { root } = board();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} });
		const listener = vi.fn();
		const off = api.subscribe(listener);
		api.create();
		expect(listener).toHaveBeenCalled();
		off();
		listener.mockClear();
		api.create();
		expect(listener).not.toHaveBeenCalled();
	});
});

describe("page plugins in the api", () => {
	it("creates a page with a preset, sets and clears its plugins, and copies them on duplicate", async () => {
		const { root, openPageDoc } = board();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage: () => {}, openPageDoc });
		const page = api.create({ preset: "boardgame" });
		expect(page.preset).toBe("boardgame");
		api.setPlugins(page.id, ["tabletop", "shape-card"]);
		const copy = await api.duplicate(page.id);
		expect(listPages(root).find((p) => p.id === copy.id)).toMatchObject({
			preset: "boardgame",
			plugins: ["tabletop", "shape-card"],
		});
		api.setPlugins(page.id, null);
		expect(listPages(root).find((p) => p.id === page.id)?.plugins).toBeUndefined();
	});
});

describe("pages-ops", () => {
	it("nextPageName は使われていない番号を選ぶ（削除済みの名前も避ける）", () => {
		const { root } = board();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} });
		const two = api.create();
		api.delete(two.id);
		expect(nextPageName(root)).toBe("ページ 3");
	});

	it("copyPageContent は空のページなら何もしない", () => {
		expect(copyPageContent(new Y.Doc(), new Y.Doc())).toBe(0);
	});
});
