import { createPage, getPage, initPagedBoard, listPages } from "@edv4h/usketch-sync";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { addCopiedPage, collectPageCopy, referencedAssetIds } from "../try-board-copy.js";
import { guestTryStatus, loginPath } from "../use-guest-try.js";

const shape = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	type: "rectangle",
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	...extra,
});

describe("try board copy", () => {
	it("シェイプが使うアセットの id を、入れ子の中まで集める", () => {
		const ids = referencedAssetIds({
			a: shape("a", { assetId: "asset:1" }),
			b: shape("b", { pages: [{ assetId: "asset:2" }, { assetId: "" }] }),
			c: shape("c"),
		});
		expect([...ids].sort()).toEqual(["asset:1", "asset:2"]);
	});

	it("今のページのシェイプ・プリセット・プラグインと、使うアセットだけを写す", () => {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "Lobby" });
		const page = createPage(root, {
			name: "Playground",
			preset: "map-terrain",
			plugins: ["elevation"],
		});
		root.getMap("assets").set("asset:1", { id: "asset:1", src: "data:a" });
		root.getMap("assets").set("asset:other", { id: "asset:other", src: "data:b" });
		const pageDoc = new Y.Doc();
		pageDoc.getMap("shapes").set("a", shape("a", { assetId: "asset:1" }));

		const copy = collectPageCopy(root, pageDoc, page.id);
		expect(copy?.page).toEqual({
			name: "Playground",
			preset: "map-terrain",
			plugins: ["elevation"],
			shapes: { a: shape("a", { assetId: "asset:1" }) },
		});
		expect([...(copy?.assets.keys() ?? [])]).toEqual(["asset:1"]);
	});

	it("1 枚目（移行したページ）はルートに残ったシェイプも写し、名前の無いページは「ページ」", () => {
		const root = new Y.Doc();
		const first = initPagedBoard(root, { name: "" });
		const second = createPage(root, { name: "2" });
		root.getMap("shapes").set("old", shape("old"));
		const pageDoc = new Y.Doc();
		pageDoc.getMap("shapes").set("new", shape("new"));
		const copy = collectPageCopy(root, pageDoc, first.id);
		expect(copy?.page.name).toBe("ページ");
		expect(Object.keys(copy?.page.shapes ?? {}).sort()).toEqual(["new", "old"]);
		expect(Object.keys(collectPageCopy(root, pageDoc, second.id)?.page.shapes ?? {})).toEqual([
			"new",
		]);
	});

	it("無いページは写さない", () => {
		const root = new Y.Doc();
		initPagedBoard(root, { name: "Lobby" });
		expect(collectPageCopy(root, new Y.Doc(), "missing")).toBeNull();
		expect(collectPageCopy(new Y.Doc(), new Y.Doc(), "missing")).toBeNull();
	});

	it("空のお試しボードには、写したページを 1 枚目として足す", () => {
		const tryRoot = new Y.Doc();
		addCopiedPage(
			tryRoot,
			"copied",
			{
				page: { name: "Playground", preset: "map-terrain", shapes: {} },
				assets: new Map([["asset:1", { id: "asset:1" }]]),
			},
			1,
		);
		expect(listPages(tryRoot)).toEqual([
			expect.objectContaining({ id: "copied", name: "Playground", preset: "map-terrain" }),
		]);
		expect(tryRoot.getMap("assets").get("asset:1")).toEqual({ id: "asset:1" });
	});

	it("ページのあるお試しボードには、末尾に足し、あるアセットは上書きしない", () => {
		const tryRoot = new Y.Doc();
		initPagedBoard(tryRoot, { name: "ページ 1" });
		tryRoot.getMap("assets").set("asset:1", { id: "asset:1", src: "mine" });
		addCopiedPage(tryRoot, "copied", {
			page: { name: "Workshop", plugins: ["map"], shapes: {} },
			assets: new Map([["asset:1", { id: "asset:1", src: "theirs" }]]),
		});
		expect(listPages(tryRoot).map((p) => p.name)).toEqual(["ページ 1", "Workshop"]);
		expect(getPage(tryRoot, "copied")?.plugins).toEqual(["map"]);
		expect(tryRoot.getMap("assets").get("asset:1")).toEqual({ id: "asset:1", src: "mine" });
	});
});

describe("guest try status", () => {
	it("ふだんは「見るだけ」と「手元で試す」、写している間はボタン無し、失敗したらもう一度", () => {
		const run = vi.fn();
		expect(guestTryStatus("idle", run)).toMatchObject({ action: { label: "手元で試す" } });
		expect(guestTryStatus("copying", run).action).toBeUndefined();
		const failed = guestTryStatus("failed", run);
		expect(failed).toMatchObject({ tone: "danger", action: { label: "もう一度" } });
		failed.action?.run();
		expect(run).toHaveBeenCalled();
	});

	it("ログインしたら今のページへ戻る", () => {
		expect(loginPath({ pathname: "/", search: "?page=region-gallery" })).toBe(
			"/login?redirect=%2F%3Fpage%3Dregion-gallery",
		);
	});
});
