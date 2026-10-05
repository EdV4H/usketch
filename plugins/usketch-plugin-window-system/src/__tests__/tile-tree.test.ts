import { describe, expect, it } from "vitest";
import {
	buildDefaultTree,
	emptyTree,
	hasLeaf,
	insert,
	insetRect,
	isEmpty,
	layoutTree,
	leafIds,
	neighbor,
	type Placement,
	type Rect,
	reconcile,
	remove,
	resize,
	setDir,
	swapLeaves,
	type TileNode,
	toggleDir,
} from "../tile-tree.js";

const SCREEN: Rect = { x: 0, y: 0, width: 1000, height: 800 };

/** Look up a placement by id (asserting presence). */
function at(ps: Placement[], id: string): Placement {
	const p = ps.find((q) => q.id === id);
	if (!p) throw new Error(`no placement for ${id}`);
	return p;
}

describe("buildDefaultTree / layoutTree", () => {
	it("空 ids は空ツリー、1 つは leaf、複数は等分 split", () => {
		expect(isEmpty(buildDefaultTree([]))).toBe(true);
		expect(buildDefaultTree(["a"])).toEqual({ type: "leaf", id: "a" });
		const t = buildDefaultTree(["a", "b"], "h");
		expect(t.type).toBe("split");
		expect(leafIds(t)).toEqual(["a", "b"]);
	});

	it("単一 leaf は画面全体を占める", () => {
		const ps = layoutTree({ type: "leaf", id: "a" }, SCREEN, 0);
		expect(ps).toEqual([{ id: "a", x: 0, y: 0, width: 1000, height: 800 }]);
	});

	it("h split は横に等分、gap は間だけ引く", () => {
		const ps = layoutTree(buildDefaultTree(["a", "b"], "h"), SCREEN, 20);
		// avail = 1000 - 20 = 980 → 各 490
		expect(at(ps, "a")).toEqual({ id: "a", x: 0, y: 0, width: 490, height: 800 });
		expect(at(ps, "b")).toEqual({ id: "b", x: 510, y: 0, width: 490, height: 800 });
	});

	it("v split は縦に等分", () => {
		const ps = layoutTree(buildDefaultTree(["a", "b"], "v"), SCREEN, 0);
		expect(at(ps, "a")).toEqual({ id: "a", x: 0, y: 0, width: 1000, height: 400 });
		expect(at(ps, "b")).toEqual({ id: "b", x: 0, y: 400, width: 1000, height: 400 });
	});

	it("入れ子 split を再帰分割する", () => {
		// 左に a、右を上下に b/c
		const tree: TileNode = {
			type: "split",
			dir: "h",
			children: [
				{ type: "leaf", id: "a" },
				{
					type: "split",
					dir: "v",
					children: [
						{ type: "leaf", id: "b" },
						{ type: "leaf", id: "c" },
					],
					fractions: [0.5, 0.5],
				},
			],
			fractions: [0.5, 0.5],
		};
		const ps = layoutTree(tree, SCREEN, 0);
		expect(at(ps, "a")).toEqual({ id: "a", x: 0, y: 0, width: 500, height: 800 });
		expect(at(ps, "b")).toEqual({ id: "b", x: 500, y: 0, width: 500, height: 400 });
		expect(at(ps, "c")).toEqual({ id: "c", x: 500, y: 400, width: 500, height: 400 });
	});
});

describe("insetRect (外側 padding)", () => {
	it("四辺を padding 分だけ内側に縮める", () => {
		expect(insetRect(SCREEN, 20)).toEqual({ x: 20, y: 20, width: 960, height: 760 });
	});

	it("padding=0 は素通し、負値は 0 にクランプ", () => {
		expect(insetRect(SCREEN, 0)).toEqual(SCREEN);
		expect(insetRect(SCREEN, -10)).toEqual(SCREEN);
	});

	it("過大な padding でも幅/高さは負にならない", () => {
		const r = insetRect(SCREEN, 10000);
		expect(r.width).toBe(0);
		expect(r.height).toBe(0);
	});

	it("padding を効かせた矩形にレイアウトすると窓が余白の内側に収まる", () => {
		const inner = insetRect(SCREEN, 40);
		const ps = layoutTree(buildDefaultTree(["a", "b"], "h"), inner, 20);
		// inner: x40..960 幅920, gap20 → 各450, a は左端 x=40
		expect(at(ps, "a")).toEqual({ id: "a", x: 40, y: 40, width: 450, height: 720 });
		expect(at(ps, "b")).toEqual({ id: "b", x: 510, y: 40, width: 450, height: 720 });
	});
});

describe("insert", () => {
	it("空ツリーへの挿入は leaf になる", () => {
		expect(insert(emptyTree(), null, "a", "h")).toEqual({ type: "leaf", id: "a" });
	});

	it("leaf ルートへの挿入は 2 分割 split", () => {
		const t = insert({ type: "leaf", id: "a" }, "a", "b", "h");
		expect(leafIds(t)).toEqual(["a", "b"]);
	});

	it("同一 orientation の親には focus の隣に兄弟として入る", () => {
		const base = buildDefaultTree(["a", "b"], "h"); // a | b
		const t = insert(base, "a", "c", "h"); // a | c | b
		expect(leafIds(t)).toEqual(["a", "c", "b"]);
	});

	it("直交 orientation では focus を入れ子 split に包む", () => {
		const base = buildDefaultTree(["a", "b"], "h"); // 横並び
		const t = insert(base, "a", "c", "v"); // a を a/c の縦 split に
		const ps = layoutTree(t, SCREEN, 0);
		// a と c は同じ x 帯（左半分）、上下に分かれる
		expect(at(ps, "a").x).toBe(at(ps, "c").x);
		expect(at(ps, "a").y).toBeLessThan(at(ps, "c").y);
	});

	it("重複 id は挿入しない", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		expect(insert(base, "a", "a", "h")).toBe(base);
	});
});

describe("remove", () => {
	it("leaf を消し singleton split を畳む", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		const t = remove(base, "b");
		expect(t).toEqual({ type: "leaf", id: "a" });
	});

	it("最後の 1 つを消すと空ツリー", () => {
		expect(isEmpty(remove({ type: "leaf", id: "a" }, "a"))).toBe(true);
	});

	it("3 兄弟から 1 つ消すと残りが再正規化される", () => {
		const base = buildDefaultTree(["a", "b", "c"], "h");
		const t = remove(base, "b");
		expect(leafIds(t)).toEqual(["a", "c"]);
		const ps = layoutTree(t, SCREEN, 0);
		expect(at(ps, "a").width).toBeCloseTo(500, 5);
		expect(at(ps, "c").width).toBeCloseTo(500, 5);
	});
});

describe("reconcile", () => {
	it("欠けた id を追加し、余分な id を除去する", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		const t = reconcile(base, ["a", "c"], "a", "h"); // b を削除、c を追加
		expect(leafIds(t).sort()).toEqual(["a", "c"]);
	});

	it("既存ツリーの構造を保ちつつ同期する", () => {
		const base = buildDefaultTree(["a"], "h");
		const t = reconcile(base, ["a", "b", "c"], "a", "h");
		expect(leafIds(t).sort()).toEqual(["a", "b", "c"]);
	});
});

describe("neighbor (幾何フォーカス)", () => {
	const grid: TileNode = {
		type: "split",
		dir: "h",
		children: [
			{
				type: "split",
				dir: "v",
				children: [
					{ type: "leaf", id: "tl" },
					{ type: "leaf", id: "bl" },
				],
				fractions: [0.5, 0.5],
			},
			{
				type: "split",
				dir: "v",
				children: [
					{ type: "leaf", id: "tr" },
					{ type: "leaf", id: "br" },
				],
				fractions: [0.5, 0.5],
			},
		],
		fractions: [0.5, 0.5],
	};
	const ps = layoutTree(grid, SCREEN, 0); // tl,bl | tr,br の 2x2

	it("右/左/上/下の隣を返す", () => {
		expect(neighbor(ps, "tl", "right")).toBe("tr");
		expect(neighbor(ps, "tr", "left")).toBe("tl");
		expect(neighbor(ps, "tl", "down")).toBe("bl");
		expect(neighbor(ps, "bl", "up")).toBe("tl");
	});

	it("端では undefined", () => {
		expect(neighbor(ps, "tl", "left")).toBeUndefined();
		expect(neighbor(ps, "tl", "up")).toBeUndefined();
		expect(neighbor(ps, "br", "right")).toBeUndefined();
		expect(neighbor(ps, "br", "down")).toBeUndefined();
	});

	it("未知の focus は undefined", () => {
		expect(neighbor(ps, "zzz", "right")).toBeUndefined();
	});
});

describe("swapLeaves (move=隣とスワップ)", () => {
	it("2 つの窓の位置を入れ替える", () => {
		const base = buildDefaultTree(["a", "b", "c"], "h");
		const t = swapLeaves(base, "a", "c");
		expect(leafIds(t)).toEqual(["c", "b", "a"]);
	});

	it("同一/欠損 id は no-op", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		expect(swapLeaves(base, "a", "a")).toBe(base);
		expect(swapLeaves(base, "a", "zzz")).toBe(base);
	});
});

describe("resize", () => {
	it("grow は focus を親軸方向に広げ、隣を縮める", () => {
		const base = buildDefaultTree(["a", "b"], "h"); // 各 0.5
		const t = resize(base, "a", 0.2); // a=0.7, b=0.3
		const ps = layoutTree(t, SCREEN, 0);
		expect(at(ps, "a").width).toBeCloseTo(700, 5);
		expect(at(ps, "b").width).toBeCloseTo(300, 5);
	});

	it("最後の子は前の兄弟からもらって広がる", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		const t = resize(base, "b", 0.2); // b=0.7
		const ps = layoutTree(t, SCREEN, 0);
		expect(at(ps, "b").width).toBeCloseTo(700, 5);
	});

	it("最小シェアを下回らないようクランプ", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		const t = resize(base, "a", 5); // 過大 → b は MIN(0.05) まで
		const ps = layoutTree(t, SCREEN, 0);
		expect(at(ps, "b").width).toBeCloseTo(50, 1);
	});

	it("ルート単独窓は no-op", () => {
		const base: TileNode = { type: "leaf", id: "a" };
		expect(resize(base, "a", 0.2)).toBe(base);
	});
});

describe("setDir / toggleDir", () => {
	it("setDir は親 split の向きを変える", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		const t = setDir(base, "a", "v");
		const ps = layoutTree(t, SCREEN, 0);
		expect(at(ps, "a").y).toBeLessThan(at(ps, "b").y); // 縦並びに
	});

	it("toggleDir は向きを反転する", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		expect((toggleDir(base, "a") as Extract<TileNode, { type: "split" }>).dir).toBe("v");
	});

	it("同じ向きの setDir は no-op、ルート単独窓も no-op", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		expect(setDir(base, "a", "h")).toBe(base);
		const solo: TileNode = { type: "leaf", id: "a" };
		expect(toggleDir(solo, "a")).toBe(solo);
	});
});

describe("hasLeaf / leafIds", () => {
	it("ツリー内の id を判定する", () => {
		const base = buildDefaultTree(["a", "b"], "h");
		expect(hasLeaf(base, "a")).toBe(true);
		expect(hasLeaf(base, "z")).toBe(false);
	});
});
