import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFreedrawConfig } from "../config.js";
import { createFreedrawSettingsStore } from "../settings-store.js";

function installLocalStorageMock() {
	const map = new Map<string, string>();
	const mock = {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
		clear: () => map.clear(),
	};
	vi.stubGlobal("localStorage", mock);
	return map;
}

afterEach(() => vi.unstubAllGlobals());

describe("createFreedrawSettingsStore", () => {
	it("既定値を返す（persist 無効）", () => {
		const s = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		const snap = s.getSnapshot();
		expect(snap.pen).toBe("ballpoint");
		expect(snap.color).toBe("#191C1C");
		expect(snap.sizes.brush).toBe(11);
		expect(snap.eraserSize).toBe(30);
		expect(snap.brushDynamics).toBe(60);
		expect(snap.mode).toBe("pen");
	});

	it("currentSize はモード/ペンに追従", () => {
		const s = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		expect(s.currentSize()).toBe(2.5);
		s.update({ pen: "brush" });
		expect(s.currentSize()).toBe(11);
		s.update({ mode: "eraser" });
		expect(s.currentSize()).toBe(30);
	});

	it("update でリスナに通知", () => {
		const s = createFreedrawSettingsStore(parseFreedrawConfig({ persistSettings: false }));
		let n = 0;
		s.subscribe(() => n++);
		s.update({ color: "#DA3F00" });
		expect(n).toBe(1);
		expect(s.getSnapshot().color).toBe("#DA3F00");
	});

	it("persist 有効: localStorage に保存し、再生成で復元", () => {
		installLocalStorageMock();
		const cfg = parseFreedrawConfig({ persistSettings: true });
		const s1 = createFreedrawSettingsStore(cfg);
		s1.update({ pen: "felt", color: "#0050E4", customColors: ["#123456"] });
		// mode は永続化しない
		s1.update({ mode: "eraser" });
		const s2 = createFreedrawSettingsStore(cfg);
		const snap = s2.getSnapshot();
		expect(snap.pen).toBe("felt");
		expect(snap.color).toBe("#0050E4");
		expect(snap.customColors).toEqual(["#123456"]);
		expect(snap.mode).toBe("pen"); // 復元されない
	});
});
