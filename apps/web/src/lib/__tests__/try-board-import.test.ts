import { createPage, initPagedBoard, listPages } from "@edv4h/usketch-sync";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addImportedPages, collectBoardPages, importedBoardIds } from "../try-board-import.js";

const shape = (id: string) => ({ id, type: "rectangle", x: 0, y: 0, width: 10, height: 10 });

describe("try board import", () => {
	it("ページを使わないボードは、ルートのシェイプを 1 ページにする", () => {
		const root = new Y.Doc();
		root.getMap("shapes").set("a", shape("a"));
		expect(collectBoardPages("会議", root, new Map())).toEqual([
			{ name: "会議", shapes: { a: shape("a") } },
		]);
	});

	it("空のボードは取り込まない", () => {
		expect(collectBoardPages("空", new Y.Doc(), new Map())).toEqual([]);
	});

	it("ページを使うボードはページごとに「ボード名 / ページ名」で、空のページは外す", () => {
		const root = new Y.Doc();
		const first = initPagedBoard(root, { name: "ページ 1" });
		const second = createPage(root, { name: "地図", preset: "map" });
		createPage(root, { name: "空" });
		const pages = collectBoardPages(
			"旅行",
			root,
			new Map([
				[first.id, { a: shape("a") }],
				[second.id, { b: shape("b") }],
			]),
		);
		expect(pages).toEqual([
			{ name: "旅行 / ページ 1", shapes: { a: shape("a") } },
			{ name: "旅行 / 地図", preset: "map", shapes: { b: shape("b") } },
		]);
	});

	it("1 ページだけのボードはボード名にする", () => {
		const root = new Y.Doc();
		const only = initPagedBoard(root, { name: "ページ 1" });
		expect(collectBoardPages("メモ", root, new Map([[only.id, { a: shape("a") }]]))[0].name).toBe(
			"メモ",
		);
	});

	it("足したページ・取り込んだボード・アセットを 1 度に書く", () => {
		const tryRoot = new Y.Doc();
		initPagedBoard(tryRoot, { name: "ページ 1" });
		tryRoot.getMap("assets").set("img1", { keep: true });
		let updates = 0;
		tryRoot.on("update", () => updates++);
		addImportedPages(
			tryRoot,
			"board-1",
			[{ id: "p1", page: { name: "会議", shapes: {} } }],
			new Map<string, unknown>([
				["img1", { keep: false }],
				["img2", { src: "x" }],
			]),
		);
		expect(updates).toBe(1);
		expect(listPages(tryRoot).map((p) => p.name)).toEqual(["ページ 1", "会議"]);
		expect(importedBoardIds(tryRoot)).toEqual(new Set(["board-1"]));
		expect(tryRoot.getMap("assets").get("img1")).toEqual({ keep: true });
		expect(tryRoot.getMap("assets").get("img2")).toEqual({ src: "x" });
	});
});
