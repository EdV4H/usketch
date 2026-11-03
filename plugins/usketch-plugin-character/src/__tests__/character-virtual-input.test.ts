import { describe, expect, it } from "vitest";
import { type MoveInput, NO_INPUT } from "../character-physics.js";
import {
	combineInput,
	isVirtualInputActive,
	normalizeVirtualInput,
} from "../character-virtual-input.js";

const keys = (p: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...p });

describe("normalizeVirtualInput", () => {
	it("clamps the axes and fills missing fields as released", () => {
		expect(normalizeVirtualInput({ throttle: 2, steer: -0.3 })).toEqual({
			throttle: 1,
			steer: -0.3,
			drift: false,
		});
		expect(normalizeVirtualInput({ drift: true })).toEqual({ throttle: 0, steer: 0, drift: true });
		expect(normalizeVirtualInput({ steer: Number.POSITIVE_INFINITY })).toBeNull();
	});
	it("treats null and an all-released control as no input", () => {
		expect(normalizeVirtualInput(null)).toBeNull();
		expect(normalizeVirtualInput({ throttle: 0, steer: 0, drift: false })).toBeNull();
		expect(isVirtualInputActive(null)).toBe(false);
		expect(isVirtualInputActive({ throttle: 0, steer: 0.1, drift: false })).toBe(true);
	});
});

describe("combineInput", () => {
	it("passes the keys through unchanged without virtual input", () => {
		const k = keys({ up: true });
		expect(combineInput(k, null)).toBe(k);
	});
	it("adds the axes (capped at ±1) and ORs the drift button", () => {
		const out = combineInput(keys({ up: true, left: true }), {
			throttle: 0.5,
			steer: 0.4,
			drift: true,
		});
		expect(out.throttle).toBe(1);
		expect(out.steer).toBeCloseTo(-0.6, 12);
		expect(out.drift).toBe(true);
		expect(
			combineInput(keys({ drift: true }), { throttle: 0.2, steer: 0, drift: false }).drift,
		).toBe(true);
	});
});
