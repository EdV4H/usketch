import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	displayMs,
	formatDuration,
	getTimerKind,
	initialCore,
	isDone,
	pause,
	registerTimerKind,
	reset,
	resolveTimerKind,
	start,
	TIMER_KINDS,
	timerTypes,
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

describe("registerTimerKind (host extension)", () => {
	// Register in setup and restore in teardown so tests are order-independent and
	// the global registry doesn't leak "pomodoro" into other test files.
	beforeAll(() => {
		// A 25-minute pomodoro that behaves like a countdown but always starts at 25m.
		registerTimerKind("pomodoro", {
			...TIMER_KINDS.countdown,
			icon: "🍅",
			initial: () => ({ anchorAt: null, accumMs: 25 * 60_000, durationMs: 25 * 60_000 }),
		});
	});
	afterAll(() => {
		delete TIMER_KINDS.pomodoro;
	});

	it("registers a custom kind that flows through the model transitions", () => {
		const e = initialCore("pomodoro", 5 * 60_000); // requested 5m is ignored by the kind
		expect(e.type).toBe("pomodoro");
		expect(displayMs(e, T0)).toBe(25 * 60_000);

		const running = start(e, T0);
		expect(displayMs(running, T0 + 60_000)).toBe(24 * 60_000);
		expect(isDone(running, T0 + 26 * 60_000)).toBe(true);
	});

	it("exposes the kind via getTimerKind / timerTypes and throws for unknown types", () => {
		expect(getTimerKind("pomodoro").icon).toBe("🍅");
		expect(timerTypes()).toEqual(expect.arrayContaining(["countdown", "stopwatch", "pomodoro"]));
		expect(() => getTimerKind("nope")).toThrow(/unknown timer type/);
	});
});

describe("resolveTimerKind (render-safe fallback)", () => {
	it("returns the registered kind, and an inert fallback for unknown types", () => {
		expect(resolveTimerKind("countdown")).toBe(TIMER_KINDS.countdown);

		// Unknown type must never throw during render — it degrades to a frozen,
		// never-done display of the stored accumMs.
		const stale = { type: "ghost", running: true, anchorAt: T0, accumMs: 42_000, durationMs: 0 };
		expect(() => resolveTimerKind("ghost")).not.toThrow();
		expect(displayMs(stale, T0 + 10_000)).toBe(42_000);
		expect(isDone(stale, T0 + 10_000)).toBe(false);
	});
});
