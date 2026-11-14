import { initPagedBoard, type PageDocHandle } from "@edv4h/usketch-sync";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import {
	collectTransferShapes,
	copyShapesToPage,
	MOVED_OUT_MAP_KEY,
	moveShapesToPage,
	removeMovedOutShapes,
	watchMovedOutShapes,
} from "../page-transfer.js";
import { createPagesApi } from "../pages-api.js";

type Shape = Record<string, unknown> & { id: string };
const shapes = (doc: Y.Doc) => doc.getMap<Shape>("shapes");

/** frame(f) の中に a と b、a→b のコネクタ ab、外の c と a→c のコネクタ ac。 */
function sourceDoc(): Y.Doc {
	const doc = new Y.Doc();
	const map = shapes(doc);
	const put = (s: Shape) => map.set(s.id, s);
	put({ id: "f", type: "frame", x: 0, y: 0, width: 100, height: 100, zIndex: "a0" });
	put({ id: "a", type: "rect", x: 10, y: 10, width: 10, height: 10, parentId: "f", zIndex: "a1" });
	put({ id: "b", type: "rect", x: 50, y: 50, width: 10, height: 10, parentId: "f", zIndex: "a2" });
	put({ id: "c", type: "rect", x: 200, y: 0, width: 10, height: 10, zIndex: "a3" });
	put({
		id: "ab",
		type: "connector",
		sourceId: "a",
		targetId: "b",
		sourcePoint: { x: 15, y: 15 },
		targetPoint: { x: 55, y: 55 },
		zIndex: "a4",
	});
	put({
		id: "ac",
		type: "connector",
		sourceId: "a",
		targetId: "c",
		sourcePoint: { x: 15, y: 15 },
		targetPoint: { x: 205, y: 5 },
		sourceAnchorRatio: { x: 0.5, y: 0.5 },
		zIndex: "a5",
	});
	return doc;
}

function targetDoc(): Y.Doc {
	const doc = new Y.Doc();
	shapes(doc).set("t", { id: "t", type: "rect", x: 0, y: 0, width: 1, height: 1, zIndex: "a9" });
	return doc;
}

describe("collectTransferShapes", () => {
	it("子孫と、両端が含まれるコネクタを重なり順で集める", () => {
		const doc = sourceDoc();
		const picked = collectTransferShapes(new Map(shapes(doc).entries()), ["f"]);
		expect(picked.map((s) => s.id)).toEqual(["f", "a", "b", "ab"]);
		expect(collectTransferShapes(new Map(shapes(doc).entries()), ["missing"])).toEqual([]);
	});
});

describe("moveShapesToPage", () => {
	it("id を変えずに移し、外への参照を外して、移動元に印を残す", () => {
		const from = sourceDoc();
		const to = targetDoc();
		const ids = moveShapesToPage(from, to, ["a", "b"], "p2");
		expect(ids.sort()).toEqual(["a", "ab", "b"]);

		// 移動先: 親（frame）は移していないので外れ、一番手前に並ぶ
		const a = shapes(to).get("a");
		expect(a?.parentId).toBeUndefined();
		expect(String(a?.zIndex) > "a9").toBe(true);
		expect(shapes(to).get("ab")).toMatchObject({ sourceId: "a", targetId: "b" });

		// 移動元: 消えて印が付き、残ったコネクタ ac は a 側の端が外れる
		expect([...shapes(from).keys()].sort()).toEqual(["ac", "c", "f"]);
		expect(from.getMap(MOVED_OUT_MAP_KEY).get("a")).toBe("p2");
		const ac = shapes(from).get("ac");
		expect(ac?.sourceId).toBeUndefined();
		expect(ac?.sourceAnchorRatio).toBeUndefined();
		expect(ac?.sourcePoint).toEqual({ x: 15, y: 15 });
		expect(ac?.targetId).toBe("c");
	});

	it("選んだコネクタの、移さない側の端は外す", () => {
		const from = sourceDoc();
		const to = targetDoc();
		moveShapesToPage(from, to, ["ac", "a"], "p2");
		const ac = shapes(to).get("ac");
		expect(ac?.sourceId).toBe("a");
		expect(ac?.targetId).toBeUndefined();
	});

	it("戻すと移動先の印が消え、移動元に戻ったシェイプは片付けで消える", () => {
		const p1 = sourceDoc();
		const p2 = targetDoc();
		moveShapesToPage(p1, p2, ["c"], "p2");
		moveShapesToPage(p2, p1, ["c"], "p1");
		expect(shapes(p1).has("c")).toBe(true);
		expect(p1.getMap(MOVED_OUT_MAP_KEY).has("c")).toBe(false);
		expect(p2.getMap(MOVED_OUT_MAP_KEY).get("c")).toBe("p1");

		// 同時編集で p2 に c が戻ってきた
		const stop = watchMovedOutShapes(p2);
		shapes(p2).set("c", { id: "c", type: "rect", x: 1 });
		expect(shapes(p2).has("c")).toBe(false);
		stop();
		shapes(p2).set("c", { id: "c", type: "rect", x: 2 });
		expect(removeMovedOutShapes(p2)).toBe(1);
	});

	it("移すものが無ければ何もしない", () => {
		expect(moveShapesToPage(sourceDoc(), targetDoc(), ["nope"], "p2")).toEqual([]);
	});
});

describe("copyShapesToPage", () => {
	it("新しい id で写し、写したものどうしの参照を張り替える。移動元は変えない", () => {
		const from = sourceDoc();
		const to = targetDoc();
		const ids = copyShapesToPage(from, to, ["f", "ac"]);
		expect(ids).toHaveLength(5);
		expect(shapes(from).size).toBe(6);
		const copied = ids.map((id) => shapes(to).get(id) as Shape);
		const frame = copied.find((s) => s.type === "frame");
		const children = copied.filter((s) => s.parentId === frame?.id);
		expect(children).toHaveLength(2);
		const ac = copied.find((s) => s.type === "connector" && s.targetId === undefined);
		// ac の a 側は写した a に張り替わり、c 側（写していない）は外れる
		expect(children.map((s) => s.id)).toContain(ac?.sourceId);
		expect(copied.every((s) => !["f", "a", "b", "ab", "ac"].includes(s.id))).toBe(true);
	});
});

describe("PagesApi の移動・コピー", () => {
	function board() {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "ページ 1", id: "p1" });
		const docs = new Map<string, Y.Doc>([["p1", sourceDoc()]]);
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

	it("今のページから別のページへ移し、open で移動先へ移る", async () => {
		const { root, docs, released, openPageDoc } = board();
		const switchPage = vi.fn();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage, openPageDoc });
		const p2 = api.create();
		expect(api.canTransfer).toBe(true);
		const moved = await api.moveShapes(["c"], p2.id, { open: true });
		expect(moved).toEqual(["c"]);
		expect(shapes(docs.get(p2.id) as Y.Doc).has("c")).toBe(true);
		expect(switchPage).toHaveBeenCalledWith(p2.id);
		expect(released.sort()).toEqual([p2.id, "p1"].sort());

		const copied = await api.copyShapes(["f"], p2.id);
		expect(copied).toHaveLength(4);
		expect(switchPage).toHaveBeenCalledTimes(1);
	});

	it("今のページ・無いページへは移せない。openPageDoc が無ければできない", async () => {
		const { root, openPageDoc } = board();
		const api = createPagesApi({ root, currentPageId: "p1", switchPage: () => {}, openPageDoc });
		await expect(api.moveShapes(["c"], "p1")).rejects.toThrow();
		await expect(api.moveShapes(["c"], "nope")).rejects.toThrow();
		const bare = createPagesApi({ root, currentPageId: "p1", switchPage: () => {} });
		expect(bare.canTransfer).toBe(false);
		await expect(bare.copyShapes(["c"], "p1")).rejects.toThrow();
	});
});
