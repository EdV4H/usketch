import { describe, expect, it } from "vitest";
import {
	displayMs,
	formatDuration,
	initialCore,
	isDone,
	pause,
	reset,
	start,
} from "../timer-model.js";

const T0 = 1_000_000; // arbitrary server epoch base
const cd = (min: number) => initialCore("countdown", min * 60_000);
const sw = () => initialCore("stopwatch", 0);

describe("countdown", () => {
	it("starts stopped showing full duration", () => {
		const e = cd(5);
		expect(e.running).toBe(false);
		expect(displayMs(e, T0)).toBe(5 * 60_000);
		expect(isDone(e, T0)).toBe(false);
	});

	it("counts down from endsAt while running", () => {
		const e = start(cd(5), T0);
		expect(e.running).toBe(true);
		expect(e.anchorAt).toBe(T0 + 5 * 60_000);
		expect(displayMs(e, T0 + 60_000)).toBe(4 * 60_000);
	});

	it("clamps to 0 and reports done past endsAt", () => {
		const e = start(cd(1), T0);
		expect(displayMs(e, T0 + 90_000)).toBe(0);
		expect(isDone(e, T0 + 90_000)).toBe(true);
	});

	it("pause snapshots remaining; resume continues from it", () => {
		const paused = pause(start(cd(5), T0), T0 + 2 * 60_000);
		expect(paused.running).toBe(false);
		expect(paused.accumMs).toBe(3 * 60_000);
		expect(displayMs(paused, T0 + 10 * 60_000)).toBe(3 * 60_000); // frozen
		const resumed = start(paused, T0 + 10 * 60_000);
		expect(resumed.anchorAt).toBe(T0 + 13 * 60_000);
		expect(displayMs(resumed, T0 + 11 * 60_000)).toBe(2 * 60_000);
	});

	it("reset returns to full configured duration, stopped", () => {
		const r = reset(start(cd(5), T0));
		expect(r.running).toBe(false);
		expect(displayMs(r, T0)).toBe(5 * 60_000);
	});
});

describe("stopwatch", () => {
	it("counts up and accumulates across pause", () => {
		const e = start(sw(), T0);
		expect(displayMs(e, T0 + 30_000)).toBe(30_000);
		expect(isDone(e, T0 + 30_000)).toBe(false);
		const paused = pause(e, T0 + 30_000);
		expect(paused.accumMs).toBe(30_000);
		expect(displayMs(paused, T0 + 99_000)).toBe(30_000); // frozen
		const resumed = start(paused, T0 + 100_000);
		expect(displayMs(resumed, T0 + 110_000)).toBe(40_000);
	});

	it("reset returns to 0", () => {
		expect(displayMs(reset(start(sw(), T0)), T0 + 5_000)).toBe(0);
	});
});

describe("start/pause idempotence", () => {
	it("start is a no-op when running, pause when paused (same ref)", () => {
		const running = start(cd(5), T0);
		expect(start(running, T0 + 1000)).toBe(running);
		const stopped = cd(5);
		expect(pause(stopped, T0 + 1000)).toBe(stopped);
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
