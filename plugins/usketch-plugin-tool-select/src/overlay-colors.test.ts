import { afterEach, describe, expect, it } from "vitest";
import {
	getOverlayColors,
	resetOverlayColors,
	setOverlayColors,
	subscribeOverlayColors,
} from "./overlay-colors.js";

afterEach(() => resetOverlayColors());

describe("overlay-colors store", () => {
	it("既定色（#2680eb / #ffffff）", () => {
		expect(getOverlayColors()).toEqual({ strokeColor: "#2680eb", handleFillColor: "#ffffff" });
	});

	it("部分更新でき、未指定キーは保持。CSS 変数も格納できる", () => {
		setOverlayColors({ strokeColor: "var(--colors-primary)" });
		expect(getOverlayColors().strokeColor).toBe("var(--colors-primary)");
		expect(getOverlayColors().handleFillColor).toBe("#ffffff");
		setOverlayColors({ handleFillColor: "#222" });
		expect(getOverlayColors()).toEqual({
			strokeColor: "var(--colors-primary)",
			handleFillColor: "#222",
		});
	});

	it("undefined / 空 patch は無視", () => {
		setOverlayColors({ strokeColor: "#abc" });
		setOverlayColors(undefined);
		setOverlayColors({ strokeColor: undefined });
		expect(getOverlayColors().strokeColor).toBe("#abc");
	});

	it("subscribe が変更で通知され、reset で既定に戻る", () => {
		let n = 0;
		const off = subscribeOverlayColors(() => n++);
		setOverlayColors({ strokeColor: "#111" });
		expect(n).toBe(1);
		resetOverlayColors();
		expect(getOverlayColors().strokeColor).toBe("#2680eb");
		off();
	});
});
