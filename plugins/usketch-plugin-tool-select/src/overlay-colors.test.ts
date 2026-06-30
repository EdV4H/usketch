import { describe, expect, it } from "vitest";
import { createOverlayColorStore } from "./overlay-colors.js";

describe("createOverlayColorStore", () => {
	it("既定色（#2680eb / #ffffff）", () => {
		expect(createOverlayColorStore().getSnapshot()).toEqual({
			strokeColor: "#2680eb",
			handleFillColor: "#ffffff",
		});
	});

	it("初期値を適用。CSS 変数も格納できる", () => {
		const s = createOverlayColorStore({ strokeColor: "var(--colors-primary)" });
		expect(s.getSnapshot().strokeColor).toBe("var(--colors-primary)");
		expect(s.getSnapshot().handleFillColor).toBe("#ffffff");
	});

	it("部分更新でき、未指定/undefined は保持", () => {
		const s = createOverlayColorStore();
		s.set({ strokeColor: "#abc" });
		s.set(undefined);
		s.set({ strokeColor: undefined });
		expect(s.getSnapshot().strokeColor).toBe("#abc");
		s.set({ handleFillColor: "#222" });
		expect(s.getSnapshot()).toEqual({ strokeColor: "#abc", handleFillColor: "#222" });
	});

	it("subscribe が変更で通知される", () => {
		const s = createOverlayColorStore();
		let n = 0;
		const off = s.subscribe(() => n++);
		s.set({ strokeColor: "#111" });
		expect(n).toBe(1);
		off();
		s.set({ strokeColor: "#222" });
		expect(n).toBe(1);
	});

	it("#640: インスタンスは独立。あるストアの破棄が別ストアの色に影響しない", () => {
		// App#1, App#2 を同色で生成 → App#1 を「teardown」しても App#2 は保持。
		const app1 = createOverlayColorStore({ strokeColor: "var(--colors-primary)" });
		const app2 = createOverlayColorStore({ strokeColor: "var(--colors-primary)" });
		// 旧実装ではモジュール共有 + teardown reset で app2 が既定に戻っていた。
		// per-instance なので app1 を捨てても app2 は不変。
		expect(app2.getSnapshot().strokeColor).toBe("var(--colors-primary)");
		// app1 をいじっても app2 に影響しない
		app1.set({ strokeColor: "#000000" });
		expect(app2.getSnapshot().strokeColor).toBe("var(--colors-primary)");
	});
});
