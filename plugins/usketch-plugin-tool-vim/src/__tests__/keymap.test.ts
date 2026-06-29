import { describe, expect, it } from "vitest";
import { parseVimConfig } from "../config/default-config.js";
import { translateKey } from "../keymap.js";

const config = parseVimConfig();
const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
	({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, ...mods }) as KeyboardEvent;

describe("translateKey - normal", () => {
	it("hjkl は MOTION（shift=false）", () => {
		expect(translateKey(key("j"), "normal", config, "").event).toEqual({
			type: "MOTION",
			dir: "down",
			shift: false,
		});
	});

	it("HJKL は MOTION（shift=true, pan）", () => {
		expect(translateKey(key("L"), "normal", config, "").event).toEqual({
			type: "MOTION",
			dir: "right",
			shift: true,
		});
	});

	it("数字は DIGIT", () => {
		expect(translateKey(key("5"), "normal", config, "").event).toEqual({ type: "DIGIT", n: 5 });
	});

	it("i / v / V / : がモード遷移", () => {
		expect(translateKey(key("i"), "normal", config, "").event).toEqual({ type: "MODE_INSERT" });
		expect(translateKey(key("v"), "normal", config, "").event).toEqual({
			type: "MODE_VISUAL",
			multi: false,
		});
		expect(translateKey(key("V"), "normal", config, "").event).toEqual({
			type: "MODE_VISUAL",
			multi: true,
		});
		expect(translateKey(key(":"), "normal", config, "").event).toEqual({ type: "MODE_COMMAND" });
	});

	it("Ctrl+r は REDO、u は UNDO", () => {
		expect(translateKey(key("r", { ctrlKey: true }), "normal", config, "").event).toEqual({
			type: "REDO",
		});
		expect(translateKey(key("u"), "normal", config, "").event).toEqual({ type: "UNDO" });
	});

	it("修飾キー付き（redo 以外）は Vim キーとして解釈しない（ブラウザ既定を尊重）", () => {
		// Ctrl+F は hop ではなく素通し（event null）
		expect(translateKey(key("f", { ctrlKey: true }), "normal", config, "").event).toBeNull();
		// Meta+L（アドレスバー）も素通し
		expect(translateKey(key("l", { metaKey: true }), "normal", config, "").event).toBeNull();
		// Ctrl+P も素通し
		expect(translateKey(key("p", { ctrlKey: true }), "visual", config, "").event).toBeNull();
	});

	it("gg は2キーで JUMP first（pending 経由）", () => {
		const first = translateKey(key("g"), "normal", config, "");
		expect(first.event).toBeNull();
		expect(first.pending).toBe("g");
		const second = translateKey(key("g"), "normal", config, first.pending);
		expect(second.event).toEqual({ type: "JUMP", to: "first" });
	});

	it("ma はマーク設定", () => {
		const first = translateKey(key("m"), "normal", config, "");
		expect(first.pending).toBe("m");
		expect(translateKey(key("a"), "normal", config, "m").event).toEqual({
			type: "SET_MARK",
			key: "a",
		});
	});

	it("プレフィックス未確定キーは破棄して通常解釈へフォールスルー（Esc が必ず通る）", () => {
		// pending "g" の後に Esc → ESCAPE が落ちる（無視されない）
		expect(translateKey(key("Escape"), "normal", config, "g").event).toEqual({ type: "ESCAPE" });
		// pending "z" の後に j → 通常の MOTION として解釈
		expect(translateKey(key("j"), "normal", config, "z").event).toEqual({
			type: "MOTION",
			dir: "down",
			shift: false,
		});
		// pending "g" の後に i → MODE_INSERT
		expect(translateKey(key("i"), "normal", config, "g").event).toEqual({ type: "MODE_INSERT" });
	});
});

describe("translateKey - insert", () => {
	it("印字可能文字は TEXT", () => {
		expect(translateKey(key("r"), "insert", config, "").event).toEqual({ type: "TEXT", char: "r" });
	});
	it("Enter は COMMIT、Esc は ESCAPE、Tab は TAB", () => {
		expect(translateKey(key("Enter"), "insert", config, "").event).toEqual({ type: "COMMIT" });
		expect(translateKey(key("Escape"), "insert", config, "").event).toEqual({ type: "ESCAPE" });
		expect(translateKey(key("Tab"), "insert", config, "").event).toEqual({
			type: "TAB",
			shift: false,
		});
	});
});

describe("translateKey - command", () => {
	it("文字は COMMAND_CHAR、Enter は RUN_COMMAND", () => {
		expect(translateKey(key("q"), "command", config, "").event).toEqual({
			type: "COMMAND_CHAR",
			char: "q",
		});
		expect(translateKey(key("Enter"), "command", config, "").event).toEqual({
			type: "RUN_COMMAND",
		});
	});
});

describe("translateKey - config remap", () => {
	it("keymap の上書きが優先される", () => {
		const remapped = parseVimConfig({ keymap: { normal: { s: "mode:insert" } } });
		expect(translateKey(key("s"), "normal", remapped, "").event).toEqual({ type: "MODE_INSERT" });
	});
});

describe("translateKey - custom bindings", () => {
	const bindings = { normal: { X: () => {} }, insert: { F2: () => {} } };
	it("バインド済みキーは CUSTOM_BINDING を返す（全モード最優先）", () => {
		expect(translateKey(key("X"), "normal", config, "", bindings).event).toEqual({
			type: "CUSTOM_BINDING",
			mode: "normal",
			key: "X",
		});
		// insert でも text 入力より優先される
		expect(translateKey(key("F2"), "insert", config, "", bindings).event).toEqual({
			type: "CUSTOM_BINDING",
			mode: "insert",
			key: "F2",
		});
	});
	it("未バインドのキーは通常解決", () => {
		expect(translateKey(key("j"), "normal", config, "", bindings).event).toEqual({
			type: "MOTION",
			dir: "down",
			shift: false,
		});
	});
});
