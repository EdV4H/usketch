import { describe, expect, it } from "vitest";
import { effectiveSnapEnabled } from "./alt-behavior.js";

describe("effectiveSnapEnabled", () => {
	it("Alt 非押下なら enabled のまま", () => {
		expect(effectiveSnapEnabled(true, false, "suppress")).toBe(true);
		expect(effectiveSnapEnabled(false, false, "invert")).toBe(false);
	});

	it("suppress: Alt 押下中は常に無効（従来）", () => {
		expect(effectiveSnapEnabled(true, true, "suppress")).toBe(false);
		expect(effectiveSnapEnabled(false, true, "suppress")).toBe(false);
	});

	it("invert: Alt 押下中は enabled を反転", () => {
		// 有効 → 一時無効（従来と同じ体感）
		expect(effectiveSnapEnabled(true, true, "invert")).toBe(false);
		// 無効 → 一時有効（新規。これが #636 の要望）
		expect(effectiveSnapEnabled(false, true, "invert")).toBe(true);
	});
});
