import { describe, expect, it } from "vitest";
import { makeTimerShape } from "../timer-shape.js";

describe("makeTimerShape", () => {
	it("uses the default 160x120 size when none is given (#784)", () => {
		const s = makeTimerShape({
			id: "t1",
			x: 0,
			y: 0,
			timerType: "countdown",
			durationMs: 5 * 60_000,
			serverNow: 1000,
		});
		expect(s.width).toBe(160);
		expect(s.height).toBe(120);
	});

	it("honors a custom initial size (#784)", () => {
		const s = makeTimerShape({
			id: "t2",
			x: 0,
			y: 0,
			timerType: "countdown",
			durationMs: 5 * 60_000,
			serverNow: 1000,
			size: { width: 340, height: 90 },
		});
		expect(s.width).toBe(340);
		expect(s.height).toBe(90);
	});

	it("carries a sub-minute duration through creation (#781)", () => {
		const s = makeTimerShape({
			id: "t3",
			x: 0,
			y: 0,
			timerType: "countdown",
			durationMs: 30_000, // 0:30 — makeTimerShape imposes no floor
			serverNow: 1000,
		});
		expect(s.durationMs).toBe(30_000);
	});
});
