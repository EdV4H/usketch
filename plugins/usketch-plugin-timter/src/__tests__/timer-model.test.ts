import { describe, expect, it } from "vitest";
import {
	createTimer,
	displayMs,
	formatDuration,
	isDone,
	pause,
	reset,
	start,
	type TimerEntry,
} from "../timer-model.js";

const T0 = 1_000_000; // arbitrary server epoch base

const mkCountdown = (min: number): TimerEntry =>
	createTimer({ id: "c", type: "countdown", durationMs: min * 60_000, userId: "u", serverNow: T0 });
const mkStopwatch = (): TimerEntry =>
	createTimer({ id: "s", type: "stopwatch", userId: "u", serverNow: T0 });

describe("countdown", () => {
	it("starts stopped showing full duration", () => {
		const e = mkCountdown(5);
		expect(e.running).toBe(false);
		expect(displayMs(e, T0)).toBe(5 * 60_000);
		expect(isDone(e, T0)).toBe(false);
	});

	it("counts down from endsAt while running", () => {
		const e = start(mkCountdown(5), T0, "u");
		expect(e.running).toBe(true);
		expect(e.anchorAt).toBe(T0 + 5 * 60_000);
		expect(displayMs(e, T0 + 60_000)).toBe(4 * 60_000); // 1 min elapsed → 4 left
	});

	it("clamps to 0 and reports done past endsAt", () => {
		const e = start(mkCountdown(1), T0, "u");
		expect(displayMs(e, T0 + 90_000)).toBe(0);
		expect(isDone(e, T0 + 90_000)).toBe(true);
	});

	it("pause snapshots remaining; resume continues from it", () => {
		const running = start(mkCountdown(5), T0, "u");
		const paused = pause(running, T0 + 2 * 60_000, "u"); // 2 min in → 3 left
		expect(paused.running).toBe(false);
		expect(paused.accumMs).toBe(3 * 60_000);
		expect(displayMs(paused, T0 + 10 * 60_000)).toBe(3 * 60_000); // frozen while paused
		const resumed = start(paused, T0 + 10 * 60_000, "u");
		expect(resumed.anchorAt).toBe(T0 + 10 * 60_000 + 3 * 60_000);
		expect(displayMs(resumed, T0 + 11 * 60_000)).toBe(2 * 60_000);
	});

	it("reset returns to full configured duration, stopped", () => {
		const r = reset(start(mkCountdown(5), T0, "u"), T0 + 60_000, "u");
		expect(r.running).toBe(false);
		expect(displayMs(r, T0 + 60_000)).toBe(5 * 60_000);
	});
});

describe("stopwatch", () => {
	it("counts up from 0 while running and accumulates across pause", () => {
		const e = start(mkStopwatch(), T0, "u");
		expect(displayMs(e, T0 + 30_000)).toBe(30_000);
		expect(isDone(e, T0 + 30_000)).toBe(false);
		const paused = pause(e, T0 + 30_000, "u");
		expect(paused.accumMs).toBe(30_000);
		expect(displayMs(paused, T0 + 99_000)).toBe(30_000); // frozen
		const resumed = start(paused, T0 + 100_000, "u");
		expect(displayMs(resumed, T0 + 110_000)).toBe(40_000); // 30 + 10
	});

	it("reset returns to 0", () => {
		const r = reset(start(mkStopwatch(), T0, "u"), T0 + 5_000, "u");
		expect(displayMs(r, T0 + 5_000)).toBe(0);
	});
});

describe("start/pause idempotence & attribution", () => {
	it("start is a no-op when already running, pause when already paused", () => {
		const running = start(mkCountdown(5), T0, "u");
		expect(start(running, T0 + 1000, "v")).toBe(running); // same ref
		const stopped = mkCountdown(5);
		expect(pause(stopped, T0 + 1000, "v")).toBe(stopped);
	});

	it("records updatedBy/updatedAt on transitions", () => {
		const e = start(mkCountdown(5), T0 + 500, "alice");
		expect(e.updatedBy).toBe("alice");
		expect(e.updatedAt).toBe(T0 + 500);
	});
});

describe("formatDuration", () => {
	it("formats M:SS and H:MM:SS, clamping negatives", () => {
		expect(formatDuration(0)).toBe("0:00");
		expect(formatDuration(65_000)).toBe("1:05");
		expect(formatDuration(3_661_000)).toBe("1:01:01");
		expect(formatDuration(-5000)).toBe("0:00");
	});
});
