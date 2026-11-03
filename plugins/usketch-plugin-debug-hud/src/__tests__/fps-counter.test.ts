import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FpsCounter } from "../fps-counter.js";

type FrameCallback = (time: number) => void;

let now = 0;
let nextId = 1;
const queue = new Map<number, FrameCallback>();

/** Run every queued frame callback once, `dtMs` after the previous frame. */
function frame(dtMs = 16): void {
	now += dtMs;
	const snapshot = [...queue.values()];
	queue.clear();
	for (const cb of snapshot) cb(now);
}

beforeEach(() => {
	now = 0;
	nextId = 1;
	queue.clear();
	vi.spyOn(performance, "now").mockImplementation(() => now);
	vi.stubGlobal("requestAnimationFrame", (cb: FrameCallback): number => {
		const id = nextId++;
		queue.set(id, cb);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
		queue.delete(id);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("FpsCounter", () => {
	it("does not schedule frames while nobody is subscribed", () => {
		const counter = new FpsCounter();
		expect(counter.isRunning()).toBe(false);
		expect(queue.size).toBe(0);
	});

	it("runs only while at least one listener is subscribed", () => {
		const counter = new FpsCounter();
		const offA = counter.subscribe(() => {});
		const offB = counter.subscribe(() => {});
		expect(counter.isRunning()).toBe(true);
		expect(queue.size).toBe(1);

		frame();
		expect(queue.size).toBe(1);

		offA();
		expect(counter.isRunning()).toBe(true);
		offB();
		expect(counter.isRunning()).toBe(false);
		expect(queue.size).toBe(0);
	});

	it("reports fps once per second and notifies listeners", () => {
		const counter = new FpsCounter();
		const listener = vi.fn();
		counter.subscribe(listener);
		expect(counter.getSnapshot()).toBe(0);

		for (let i = 0; i < 50; i++) frame(20);
		expect(listener).toHaveBeenCalledTimes(1);
		expect(counter.getSnapshot()).toBe(50);
		expect(counter.getHistory()).toEqual([50]);
	});

	it("starts with a fresh reading and history after a restart", () => {
		const counter = new FpsCounter();
		let off = counter.subscribe(() => {});
		for (let i = 0; i < 50; i++) frame(20);
		expect(counter.getSnapshot()).toBe(50);
		off();

		// Hidden for a while: no frames run, so nothing is measured.
		now += 30_000;
		off = counter.subscribe(() => {});
		expect(counter.getSnapshot()).toBe(0);
		expect(counter.getHistory()).toEqual([]);
		for (let i = 0; i < 25; i++) frame(40);
		expect(counter.getSnapshot()).toBe(25);
		expect(counter.getHistory()).toEqual([25]);
		off();
	});

	it("dispose stops the loop and drops listeners", () => {
		const counter = new FpsCounter();
		const listener = vi.fn();
		counter.subscribe(listener);
		counter.dispose();
		expect(counter.isRunning()).toBe(false);
		expect(queue.size).toBe(0);
		for (let i = 0; i < 120; i++) frame();
		expect(listener).not.toHaveBeenCalled();
	});
});
