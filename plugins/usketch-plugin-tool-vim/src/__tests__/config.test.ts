import { describe, expect, it } from "vitest";
import { DEFAULT_SHAPE_MAP, parseVimConfig } from "../config/default-config.js";

describe("parseVimConfig", () => {
	it("空入力で既定値を返す", () => {
		const c = parseVimConfig();
		expect(c.cursorStep).toBe(20);
		expect(c.panStep).toBe(80);
		expect(c.snapToGrid).toBe(true);
		expect(c.exitToolId).toBe("select");
		expect(c.shapeMap.rect.type).toBe("rectangle");
	});

	it("shapeMap は既定とマージされる（既定の別名を保つ）", () => {
		const c = parseVimConfig({ shapeMap: { foo: { type: "ellipse" } } });
		expect(c.shapeMap.foo.type).toBe("ellipse");
		expect(c.shapeMap.rect).toEqual(DEFAULT_SHAPE_MAP.rect);
	});

	it("スカラ値は上書きされる", () => {
		const c = parseVimConfig({ cursorStep: 50, snapToGrid: false });
		expect(c.cursorStep).toBe(50);
		expect(c.snapToGrid).toBe(false);
	});

	it("不正な値は例外", () => {
		expect(() => parseVimConfig({ cursorStep: -1 })).toThrow();
	});

	it("hopKeys はトリガー除外後に2文字以上必要（不足は例外）", () => {
		// "ff" → トリガー f 除外で空になり不正
		expect(() => parseVimConfig({ hopKeys: "ff" })).toThrow();
		// "fa" → 除外後 "a" の1文字で不正
		expect(() => parseVimConfig({ hopKeys: "fa" })).toThrow();
		// "fab" → 除外後 "a","b" でOK
		expect(() => parseVimConfig({ hopKeys: "fab" })).not.toThrow();
	});
});
