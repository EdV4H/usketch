import { afterEach, describe, expect, it, vi } from "vitest";
import {
	createHeightDriver,
	DEFAULT_HEIGHT_KEYS,
	HEIGHT_DRIVER_HOLD_MS,
	heightStep,
	resolveHeightKeys,
	setupHeightKeys,
} from "../mode7-height-keys.js";
import { createMode7Store } from "../mode7-store.js";

describe("heightStep", () => {
	it("moves at a steady on-screen speed, up or down", () => {
		expect(heightStep(1, 480, 0.5 / 10, 1)).toBeCloseTo(24, 9);
		expect(heightStep(-1, 480, 0.05, 2)).toBeCloseTo(-12, 9); // world units shrink with zoom
		expect(heightStep(0, 480, 0.05, 1)).toBe(0);
		expect(heightStep(1, 480, 1, 1)).toBeCloseTo(24, 9); // a long pause is capped
	});
});

describe("resolveHeightKeys", () => {
	it("defaults to Space / Shift, rebinds per side, and turns off with false", () => {
		expect(resolveHeightKeys(undefined)).toEqual(DEFAULT_HEIGHT_KEYS);
		expect(resolveHeightKeys({ up: ["KeyE"] })).toEqual({
			up: ["KeyE"],
			down: DEFAULT_HEIGHT_KEYS.down,
		});
		expect(resolveHeightKeys(false)).toBeNull();
	});
});

describe("setupHeightKeys", () => {
	afterEach(() => vi.unstubAllGlobals());

	function harness() {
		const target = new EventTarget();
		const frames: ((t: number) => void)[] = [];
		vi.stubGlobal("window", target);
		vi.stubGlobal("requestAnimationFrame", (fn: (t: number) => void) => frames.push(fn));
		vi.stubGlobal("cancelAnimationFrame", () => {});
		const key = (type: string, code: string, init: Record<string, unknown> = {}) => {
			const e = new Event(type, { cancelable: true });
			for (const [k, v] of Object.entries({ code, ...init })) {
				Object.defineProperty(e, k, { value: v });
			}
			target.dispatchEvent(e);
			return e;
		};
		const run = (t: number) => {
			const fn = frames.shift();
			fn?.(t);
		};
		return { key, run, frames };
	}

	it("raises the camera while Space is held in the 3D view, and lowers it with Shift", () => {
		const { key, run } = harness();
		const store = createMode7Store({ active: true });
		const config = { keys: DEFAULT_HEIGHT_KEYS, speed: 480 };
		const stop = setupHeightKeys(store, config, () => 1);
		const down = key("keydown", "Space");
		expect(down.defaultPrevented).toBe(true);
		run(0);
		run(50);
		expect(store.getState().camera.height).toBeCloseTo(24, 6);
		key("keyup", "Space");
		run(100); // released: the loop stops
		expect(store.getState().camera.height).toBeCloseTo(24, 6);
		key("keydown", "ShiftLeft");
		run(200);
		run(250);
		expect(store.getState().camera.height).toBeCloseTo(0, 6);
		stop();
	});

	it("leaves the height alone while something else drives it", () => {
		const { key, run } = harness();
		const store = createMode7Store({ active: true });
		const config = { keys: DEFAULT_HEIGHT_KEYS, speed: 480 };
		let driven = true;
		const stop = setupHeightKeys(
			store,
			config,
			() => 1,
			() => driven,
		);
		key("keydown", "ShiftLeft");
		run(0);
		run(50);
		expect(store.getState().camera.height ?? 0).toBe(0);
		driven = false; // the follower let go: the key works again
		run(100);
		expect(store.getState().camera.height).toBeCloseTo(-24, 6);
		stop();
	});

	it("ignores the keys while the view is flat, in text fields, or when turned off", () => {
		const { key, frames } = harness();
		const store = createMode7Store({ active: false });
		const config = { keys: DEFAULT_HEIGHT_KEYS, speed: 480 } as {
			keys: typeof DEFAULT_HEIGHT_KEYS | null;
			speed: number;
		};
		const stop = setupHeightKeys(store, config, () => 1);
		expect(key("keydown", "Space").defaultPrevented).toBe(false);
		store.setActive(true);
		expect(key("keydown", "Space", { target: { tagName: "INPUT" } }).defaultPrevented).toBe(false);
		config.keys = null;
		expect(key("keydown", "Space").defaultPrevented).toBe(false);
		expect(frames.length).toBe(0);
		stop();
	});
});

describe("createHeightDriver", () => {
	it("counts as driving for a short hold after each mark", () => {
		let t = 1000;
		const driver = createHeightDriver(() => t);
		expect(driver.active()).toBe(false);
		driver.mark();
		t += HEIGHT_DRIVER_HOLD_MS - 1;
		expect(driver.active()).toBe(true);
		t += 2;
		expect(driver.active()).toBe(false);
	});
});
