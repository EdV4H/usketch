import { beforeEach, describe, expect, it } from "vitest";
import { createActor } from "xstate";
import { parseVimConfig } from "../config/default-config.js";
import type { VimExtensions } from "../extensions.js";
import { vimMachine } from "../machine/vim-machine.js";
import { addRect, makeDeps, type TestDeps } from "./test-helpers.js";

function start(deps: TestDeps, extensions = {}) {
	const actor = createActor(vimMachine, {
		input: { config: parseVimConfig(), deps, extensions, initialCursor: { x: 0, y: 0 } },
	});
	actor.start();
	return actor;
}

describe("vimMachine", () => {
	let deps: TestDeps;
	beforeEach(() => {
		deps = makeDeps();
	});

	it("normal で起動する", () => {
		const a = start(deps);
		expect(a.getSnapshot().value).toBe("normal");
	});

	it("hjkl でカーソルが動き count がリセットされる", () => {
		const a = start(deps);
		a.send({ type: "MOTION", dir: "down", shift: false });
		expect(a.getSnapshot().context.cursor).toEqual({ x: 0, y: 20 });
		a.send({ type: "DIGIT", n: 3 });
		a.send({ type: "MOTION", dir: "down", shift: false });
		expect(a.getSnapshot().context.cursor).toEqual({ x: 0, y: 80 });
		expect(a.getSnapshot().context.count).toBeNull();
	});

	it("HJKL は画角を pan し、カーソルが追従して画面上の位置を保つ", () => {
		const a = start(deps);
		const before = deps.store.getViewport();
		// 右 pan: panStep=80, zoom=1 → dx=-80, cursor.x -= dx/zoom = +80
		a.send({ type: "MOTION", dir: "right", shift: true });
		const vp = deps.store.getViewport();
		expect(vp.x).toBe(before.x - 80);
		const cur = a.getSnapshot().context.cursor;
		expect(cur).toEqual({ x: 80, y: 0 });
		// world→screen が pan 前と同じ（画面上の位置が不変）
		expect(cur.x * vp.zoom + vp.x).toBe(0);
	});

	it("insert で文字入力→候補→COMMIT で shape が追加される", () => {
		const a = start(deps);
		a.send({ type: "MODE_INSERT" });
		expect(a.getSnapshot().value).toBe("insert");
		for (const char of "rec") a.send({ type: "TEXT", char });
		expect(a.getSnapshot().context.candidates.length).toBeGreaterThan(0);
		a.send({ type: "COMMIT" });
		expect(deps.store.getShapes().size).toBe(1);
		// 連続入力できるよう insert に留まりバッファはクリア
		expect(a.getSnapshot().value).toBe("insert");
		expect(a.getSnapshot().context.inputBuffer).toBe("");
		a.send({ type: "ESCAPE" });
		expect(a.getSnapshot().value).toBe("normal");
	});

	it("visual に入ると最近傍が選択され、V で複数選択へ", () => {
		addRect(deps, 0, 0);
		const a = start(deps);
		a.send({ type: "MODE_VISUAL", multi: false });
		expect(a.getSnapshot().value).toEqual({ visual: "single" });
		expect([...deps.store.getSelection()]).toEqual(["s_0_0"]);
		a.send({ type: "MODE_VISUAL", multi: true });
		expect(a.getSnapshot().value).toEqual({ visual: "multi" });
		a.send({ type: "ESCAPE" });
		expect(a.getSnapshot().value).toBe("normal");
		expect(deps.store.getSelection().size).toBe(0);
	});

	it("visual で h/l により選択が方向最近傍へ移動", () => {
		addRect(deps, 0, 0); // center 50,40
		addRect(deps, 200, 0); // center 250,40
		const a = start(deps);
		// カーソルを左の shape 中心付近へ
		a.send({ type: "MODE_VISUAL", multi: false });
		// selectNearest は (0,0) に最も近い s_0_0 を選ぶ
		expect([...deps.store.getSelection()]).toEqual(["s_0_0"]);
		a.send({ type: "MOTION", dir: "right", shift: false });
		expect([...deps.store.getSelection()]).toEqual(["s_200_0"]);
	});

	it("command で :q が exitToolId へ切り替える", () => {
		deps.store.setActiveToolId("vim");
		const a = start(deps);
		a.send({ type: "MODE_COMMAND" });
		a.send({ type: "COMMAND_CHAR", char: "q" });
		a.send({ type: "RUN_COMMAND" });
		expect(deps.store.getActiveToolId()).toBe("select");
		expect(a.getSnapshot().value).toBe("normal");
	});

	it(":help で helpVisible がトグルし、Esc で閉じる", () => {
		const a = start(deps);
		const runHelp = () => {
			a.send({ type: "MODE_COMMAND" });
			for (const char of "help") a.send({ type: "COMMAND_CHAR", char });
			a.send({ type: "RUN_COMMAND" });
		};
		runHelp();
		expect(a.getSnapshot().context.helpVisible).toBe(true);
		runHelp();
		expect(a.getSnapshot().context.helpVisible).toBe(false);
		// 開いてから Esc で閉じる
		runHelp();
		expect(a.getSnapshot().context.helpVisible).toBe(true);
		a.send({ type: "ESCAPE" });
		expect(a.getSnapshot().context.helpVisible).toBe(false);
	});

	it("M でカーソルが画面中央（world）へ移動する", () => {
		const a = start(deps);
		// 初期カーソルは {0,0}。viewport 既定 (x:0,y:0,zoom:1) かつテスト環境の
		// 画面サイズ 1280x720 → 中央 world = (640, 360)（snap で 640/360）。
		a.send({ type: "CURSOR_CENTER" });
		expect(a.getSnapshot().context.cursor).toEqual({ x: 640, y: 360 });
	});

	it(":center も同様にカーソルを中央へ移動する", () => {
		const a = start(deps);
		a.send({ type: "MODE_COMMAND" });
		for (const char of "center") a.send({ type: "COMMAND_CHAR", char });
		a.send({ type: "RUN_COMMAND" });
		expect(a.getSnapshot().context.cursor).toEqual({ x: 640, y: 360 });
		expect(a.getSnapshot().value).toBe("normal");
	});

	it(":set bg=dots はイベントを emit する", () => {
		const a = start(deps);
		a.send({ type: "MODE_COMMAND" });
		for (const char of "set bg=dots") a.send({ type: "COMMAND_CHAR", char });
		a.send({ type: "RUN_COMMAND" });
		expect(deps.events.emitted).toContainEqual({
			event: "vim:set-background",
			data: { value: "dots" },
		});
	});

	it("delete → undo で shape が復活する", () => {
		addRect(deps, 0, 0);
		const a = start(deps);
		a.send({ type: "MODE_VISUAL", multi: false });
		a.send({ type: "OPERATOR", op: "delete" });
		expect(deps.store.getShapes().size).toBe(0);
		expect(a.getSnapshot().value).toBe("normal");
		a.send({ type: "UNDO" });
		expect(deps.store.getShapes().size).toBe(1);
	});

	it("yank → paste で shape が複製される", () => {
		addRect(deps, 0, 0);
		const a = start(deps);
		a.send({ type: "MODE_VISUAL", multi: false });
		a.send({ type: "OPERATOR", op: "yank" });
		expect(a.getSnapshot().context.register.length).toBe(1);
		a.send({ type: "PASTE" });
		expect(deps.store.getShapes().size).toBe(2);
	});

	it("hop: f で開始しラベル入力でカーソルがジャンプする（1文字ラベル）", () => {
		addRect(deps, 0, 0); // center 50,40
		addRect(deps, 300, 200); // center 350,240
		const a = start(deps);
		a.send({ type: "HOP_START" });
		expect(a.getSnapshot().value).toBe("hop");
		const labels = a.getSnapshot().context.hopLabels;
		expect(labels.length).toBe(2);
		// 2番目の shape のラベルを入力 → その中心へジャンプ
		const target = labels.find((l) => l.id === "s_300_200");
		if (!target) throw new Error("label not found");
		a.send({ type: "HOP_KEY", char: target.label });
		expect(a.getSnapshot().value).toBe("normal");
		expect(a.getSnapshot().context.cursor).toEqual({ x: 350, y: 240 });
		// 抜けたらラベルはクリア
		expect(a.getSnapshot().context.hopLabels).toEqual([]);
	});

	it("hop: ラベルはトリガー文字 f を含まない（f+ラベルが別キーになる）", () => {
		for (let i = 0; i < 25; i++) addRect(deps, i * 10, i * 10);
		const a = start(deps);
		a.send({ type: "HOP_START" });
		const labels = a.getSnapshot().context.hopLabels;
		expect(labels.every((l) => !l.label.includes("f"))).toBe(true);
	});

	it("hop: Esc でキャンセルしカーソルは不変", () => {
		addRect(deps, 0, 0);
		const a = start(deps);
		a.send({ type: "HOP_START" });
		a.send({ type: "ESCAPE" });
		expect(a.getSnapshot().value).toBe("normal");
		expect(a.getSnapshot().context.cursor).toEqual({ x: 0, y: 0 });
		expect(a.getSnapshot().context.hopLabels).toEqual([]);
	});

	it("hop: shape 多数で2文字ラベルになり、2打でジャンプ", () => {
		// hopKeys 既定長を超える数の shape を作る
		const n = 30;
		for (let i = 0; i < n; i++) addRect(deps, i * 10, i * 10);
		const a = start(deps);
		a.send({ type: "HOP_START" });
		const labels = a.getSnapshot().context.hopLabels;
		expect(labels.every((l) => l.label.length === 2)).toBe(true);
		const target = labels[5];
		a.send({ type: "HOP_KEY", char: target.label[0] });
		// まだ確定しない（複数候補）
		expect(a.getSnapshot().value).toBe("hop");
		expect(a.getSnapshot().context.hopBuffer).toBe(target.label[0]);
		a.send({ type: "HOP_KEY", char: target.label[1] });
		expect(a.getSnapshot().value).toBe("normal");
		expect(a.getSnapshot().context.cursor).toEqual({ x: target.cx, y: target.cy });
	});

	it("delete / yank / paste は count を消費する（次の motion へ持ち越さない）", () => {
		addRect(deps, 0, 0);
		const a = start(deps);
		a.send({ type: "DIGIT", n: 5 });
		a.send({ type: "OPERATOR", op: "delete" });
		expect(a.getSnapshot().context.count).toBeNull();

		addRect(deps, 0, 0);
		a.send({ type: "DIGIT", n: 3 });
		a.send({ type: "OPERATOR", op: "yank" });
		expect(a.getSnapshot().context.count).toBeNull();

		a.send({ type: "DIGIT", n: 2 });
		a.send({ type: "PASTE" });
		expect(a.getSnapshot().context.count).toBeNull();
	});

	it("空レジスタの paste でも count はリセットされる", () => {
		const a = start(makeDeps());
		a.send({ type: "DIGIT", n: 4 });
		a.send({ type: "PASTE" });
		expect(a.getSnapshot().context.count).toBeNull();
	});

	it("独自 ex コマンドが api 経由で実行される（組み込みより優先）", () => {
		const seen: string[] = [];
		const extensions: VimExtensions = {
			commands: {
				greet: (args, api) => {
					seen.push(args.join(","));
					api.setCursor({ x: 11, y: 22 });
					return `hi ${args[0] ?? ""}`;
				},
			},
		};
		const a = start(deps, extensions);
		a.send({ type: "MODE_COMMAND" });
		for (const ch of "greet bob") a.send({ type: "COMMAND_CHAR", char: ch });
		a.send({ type: "RUN_COMMAND" });
		expect(seen).toEqual(["bob"]);
		expect(a.getSnapshot().context.lastMessage).toBe("hi bob");
		expect(a.getSnapshot().context.cursor).toEqual({ x: 11, y: 22 });
		expect(a.getSnapshot().value).toBe("normal");
	});

	it("独自キーバインドが CUSTOM_BINDING で実行される", () => {
		let called = 0;
		const extensions: VimExtensions = {
			bindings: {
				normal: {
					X: (api) => {
						called++;
						api.setCursor({ x: 7, y: 7 });
					},
				},
			},
		};
		const a = start(deps, extensions);
		a.send({ type: "CUSTOM_BINDING", mode: "normal", key: "X" });
		expect(called).toBe(1);
		expect(a.getSnapshot().context.cursor).toEqual({ x: 7, y: 7 });
	});

	it("独自バインドの api.setMode でモード遷移できる", () => {
		const extensions: VimExtensions = {
			bindings: { normal: { o: (api) => api.setMode("insert") } },
		};
		const a = start(deps, extensions);
		a.send({ type: "CUSTOM_BINDING", mode: "normal", key: "o" });
		expect(a.getSnapshot().value).toBe("insert");
	});
});
