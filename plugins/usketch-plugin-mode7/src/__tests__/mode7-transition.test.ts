import { describe, expect, it } from "vitest";
import { createMode7Store } from "../mode7-store.js";
import { drawDistanceClip, transitionCamera } from "../mode7-transform.js";
import {
	createMode7Transition,
	DEFAULT_TRANSITION_MS,
	type Mode7Clock,
	resolveEasing,
} from "../mode7-transition.js";

/** A hand-driven clock: `tick(ms)` advances time and runs the pending frame. */
function manualClock(reducedMotion = false) {
	let t = 0;
	let nextId = 1;
	const pending = new Map<number, (now: number) => void>();
	const clock: Mode7Clock & { tick(ms: number): void; pendingCount(): number } = {
		now: () => t,
		requestFrame(cb) {
			const id = nextId++;
			pending.set(id, cb);
			return id;
		},
		cancelFrame(id) {
			pending.delete(id);
		},
		prefersReducedMotion: () => reducedMotion,
		tick(ms) {
			t += ms;
			const cbs = [...pending.values()];
			pending.clear();
			for (const cb of cbs) cb(t);
		},
		pendingCount: () => pending.size,
	};
	return clock;
}

describe("mode7 transition", () => {
	it("switches instantly by default (durationMs 0) — the old behavior", () => {
		const store = createMode7Store();
		const clock = manualClock();
		const tr = createMode7Transition(store, {}, clock);
		tr.enable();
		expect(store.getState()).toMatchObject({
			active: true,
			progress: 1,
			amount: 1,
			transitioning: false,
		});
		expect(clock.pendingCount()).toBe(0);
		tr.disable();
		expect(store.getState()).toMatchObject({ active: false, progress: 0, amount: 0 });
	});

	it("enter: active at once, progress rises to 1 over the duration, one update per frame", () => {
		const store = createMode7Store();
		const clock = manualClock();
		const tr = createMode7Transition(store, { durationMs: 1000, easing: "linear" }, clock);
		let notifications = 0;
		store.subscribe(() => notifications++);

		tr.enable();
		expect(store.getState()).toMatchObject({
			active: true,
			progress: 0,
			amount: 0,
			transitioning: true,
		});
		expect(tr.isTransitioning()).toBe(true);
		notifications = 0;

		clock.tick(250);
		expect(store.getState().progress).toBeCloseTo(0.25, 9);
		expect(store.getState().amount).toBeCloseTo(0.25, 9);
		expect(notifications).toBe(1);

		clock.tick(800); // past the end → settles
		expect(store.getState()).toMatchObject({
			active: true,
			progress: 1,
			amount: 1,
			transitioning: false,
		});
		expect(clock.pendingCount()).toBe(0);
	});

	it("exit: stays active (capture layer blocks edits) until flat, then turns off", () => {
		const store = createMode7Store({ active: true });
		const clock = manualClock();
		const tr = createMode7Transition(store, { durationMs: 400, easing: "linear" }, clock);
		tr.disable();
		clock.tick(200);
		expect(store.getState()).toMatchObject({ active: true, transitioning: true });
		expect(store.getState().progress).toBeCloseTo(0.5, 9);
		clock.tick(250);
		expect(store.getState()).toMatchObject({
			active: false,
			progress: 0,
			amount: 0,
			transitioning: false,
		});
	});

	it("toggling mid-transition reverses from the current progress (no jump)", () => {
		const store = createMode7Store();
		const clock = manualClock();
		const tr = createMode7Transition(store, { durationMs: 1000, easing: "linear" }, clock);
		tr.toggle(); // → on
		clock.tick(600);
		expect(store.getState().progress).toBeCloseTo(0.6, 9);
		tr.toggle(); // → off, from 0.6
		expect(store.getState().progress).toBeCloseTo(0.6, 9);
		clock.tick(100);
		expect(store.getState().progress).toBeCloseTo(0.5, 9);
		expect(clock.pendingCount()).toBe(1); // still one loop
		clock.tick(600);
		expect(store.getState()).toMatchObject({ active: false, progress: 0 });
	});

	it("an explicit { animate: true } animates with the default duration", () => {
		const store = createMode7Store();
		const clock = manualClock();
		const tr = createMode7Transition(store, {}, clock);
		tr.enable({ animate: true });
		clock.tick(DEFAULT_TRANSITION_MS / 2);
		expect(store.getState().transitioning).toBe(true);
		clock.tick(DEFAULT_TRANSITION_MS);
		expect(store.getState()).toMatchObject({ active: true, progress: 1, transitioning: false });
	});

	it("{ animate: false } overrides a configured transition", () => {
		const store = createMode7Store();
		const tr = createMode7Transition(store, { durationMs: 500 }, manualClock());
		tr.enable({ animate: false });
		expect(store.getState()).toMatchObject({ active: true, progress: 1, transitioning: false });
	});

	it("prefers-reduced-motion skips to the end state", () => {
		const store = createMode7Store();
		const clock = manualClock(true);
		const tr = createMode7Transition(store, { durationMs: 900 }, clock);
		tr.enable();
		expect(store.getState()).toMatchObject({ active: true, progress: 1, transitioning: false });
		expect(clock.pendingCount()).toBe(0);
	});

	it("an instant switch cancels a running animation", () => {
		const store = createMode7Store();
		const clock = manualClock();
		const tr = createMode7Transition(store, { durationMs: 1000 }, clock);
		tr.enable();
		clock.tick(300);
		tr.disable({ animate: false });
		expect(store.getState()).toMatchObject({ active: false, progress: 0, transitioning: false });
		expect(clock.pendingCount()).toBe(0);
	});

	it("re-enabling when already fully on is a no-op", () => {
		const store = createMode7Store({ active: true });
		const clock = manualClock();
		const tr = createMode7Transition(store, { durationMs: 500 }, clock);
		let n = 0;
		store.subscribe(() => n++);
		tr.enable();
		expect(n).toBe(0);
		expect(clock.pendingCount()).toBe(0);
	});

	it("applies the configured easing to the rendered amount", () => {
		const store = createMode7Store();
		const clock = manualClock();
		const tr = createMode7Transition(store, { durationMs: 1000, easing: "ease-in" }, clock);
		tr.enable();
		clock.tick(500);
		expect(store.getState().progress).toBeCloseTo(0.5, 9);
		expect(store.getState().amount).toBeCloseTo(resolveEasing("ease-in")(0.5), 9);
	});
});

describe("rendering at a transition amount", () => {
	it("scales pitch and yaw toward flat", () => {
		const cam = { pitch: 60, yaw: 30, fov: 700, horizon: 0.3 };
		expect(transitionCamera(cam, 1)).toBe(cam);
		expect(transitionCamera(cam, 0.5)).toEqual({ pitch: 30, yaw: 15, fov: 700, horizon: 0.3 });
		expect(transitionCamera(cam, 0)).toMatchObject({ pitch: 0, yaw: 0 });
	});
	it("fades a near-band draw-distance clip in with the tilt", () => {
		expect(drawDistanceClip(300, 1, 600, 1)).toBe("inset(50% 0% 0% 0%)");
		expect(drawDistanceClip(300, 1, 600, 0.5)).toBe("inset(25% 0% 0% 0%)");
		expect(drawDistanceClip(300, 1, 600, 0)).toBe("inset(0% 0% 0% 0%)");
	});
});
