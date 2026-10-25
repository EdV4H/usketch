import { describe, expect, it } from "vitest";
import { createHandleClickTracker } from "./handle-double-click.js";

describe("createHandleClickTracker", () => {
	it("同じ図形の同じハンドルを 400ms 以内に 2 回押すとダブルクリック", () => {
		const track = createHandleClickTracker();
		expect(track("s1", "e", 1000)).toBe(false);
		expect(track("s1", "e", 1300)).toBe(true);
	});

	it("間隔が 400ms 以上ならダブルクリックではない", () => {
		const track = createHandleClickTracker();
		track("s1", "e", 1000);
		expect(track("s1", "e", 1400)).toBe(false);
	});

	it("別のハンドルや別の図形ならダブルクリックではない", () => {
		const track = createHandleClickTracker();
		track("s1", "e", 1000);
		expect(track("s1", "w", 1100)).toBe(false);
		expect(track("s2", "w", 1200)).toBe(false);
	});

	it("3 回目のクリックは新しい 1 回目として数える", () => {
		const track = createHandleClickTracker();
		track("s1", "e", 1000);
		expect(track("s1", "e", 1100)).toBe(true);
		expect(track("s1", "e", 1200)).toBe(false);
	});
});
