import { describe, expect, it } from "vitest";
import { needsCorrection, playbackFrom, projectTime } from "../playback.js";
import type { PlaybackState } from "../types.js";

const T0 = 1_000_000;
const playing: PlaybackState = { playing: true, time: 10, at: T0, updatedBy: "u" };
const paused: PlaybackState = { playing: false, time: 10, at: T0, updatedBy: "u" };

describe("projectTime", () => {
	it("advances while playing by elapsed wall time", () => {
		expect(projectTime(playing, T0)).toBe(10);
		expect(projectTime(playing, T0 + 5000)).toBe(15); // +5s
	});
	it("is frozen while paused", () => {
		expect(projectTime(paused, T0 + 5000)).toBe(10);
	});
	it("clamps negative to 0", () => {
		expect(projectTime({ ...playing, time: 1 }, T0 - 5000)).toBe(0);
	});
});

describe("needsCorrection", () => {
	it("true on play/pause mismatch", () => {
		expect(needsCorrection(playing, T0, { playing: false, time: 10 })).toBe(true);
	});
	it("true when position drift exceeds the threshold", () => {
		expect(needsCorrection(playing, T0 + 5000, { playing: true, time: 12 })).toBe(true); // expected 15, local 12
	});
	it("false within the threshold", () => {
		expect(needsCorrection(playing, T0 + 5000, { playing: true, time: 14.8 })).toBe(false); // expected 15
	});
});

describe("playbackFrom", () => {
	it("captures the local player state + server time + user", () => {
		expect(playbackFrom({ playing: true, time: 42 }, T0, "alice")).toEqual({
			playing: true,
			time: 42,
			at: T0,
			updatedBy: "alice",
		});
	});
});
