import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventLogger } from "../event-logger.js";

type FrameCallback = (time: number) => void;

interface FakeRaf {
	flush: () => void;
	scheduled: () => number;
}

function installFakeRaf(): FakeRaf {
	let nextId = 1;
	const queue = new Map<number, FrameCallback>();

	vi.stubGlobal("requestAnimationFrame", (cb: FrameCallback): number => {
		const id = nextId++;
		queue.set(id, cb);
		return id;
	});
	vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
		queue.delete(id);
	});

	return {
		flush: () => {
			const snapshot = [...queue.entries()];
			queue.clear();
			for (const [, cb] of snapshot) cb(performance.now());
		},
		scheduled: () => queue.size,
	};
}

describe("EventLogger", () => {
	let raf: FakeRaf;

	beforeEach(() => {
		raf = installFakeRaf();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("does not schedule rAF when there are no listeners", () => {
		const logger = new EventLogger();

		logger.push({ event: "shape:updated", timestamp: 1 });
		logger.push({ event: "shape:updated", timestamp: 2 });

		expect(raf.scheduled()).toBe(0);
		// Snapshot remains untouched until a flush — listener-less consumers see stale data,
		// which is the deliberate trade for keeping the drag path cheap.
		expect(logger.getSnapshot()).toEqual([]);
	});

	it("coalesces many pushes into a single rAF flush", () => {
		const logger = new EventLogger();
		const listener = vi.fn();
		logger.subscribe(listener);

		for (let i = 0; i < 50; i++) {
			logger.push({ event: "shape:updated", timestamp: i });
		}

		expect(raf.scheduled()).toBe(1);
		expect(listener).not.toHaveBeenCalled();

		raf.flush();

		expect(listener).toHaveBeenCalledTimes(1);
		const snapshot = logger.getSnapshot();
		expect(snapshot).toHaveLength(1);
		expect(snapshot[0]).toMatchObject({ event: "shape:updated", count: 50 });
	});

	it("keeps the same snapshot reference between flushes", () => {
		const logger = new EventLogger();
		logger.subscribe(() => {});

		logger.push({ event: "tool:activated", timestamp: 1 });
		raf.flush();
		const first = logger.getSnapshot();
		const second = logger.getSnapshot();

		expect(second).toBe(first);
	});

	it("produces a new snapshot reference after a new flush", () => {
		const logger = new EventLogger();
		logger.subscribe(() => {});

		logger.push({ event: "a", timestamp: 1 });
		raf.flush();
		const before = logger.getSnapshot();

		logger.push({ event: "b", timestamp: 2 });
		raf.flush();
		const after = logger.getSnapshot();

		expect(after).not.toBe(before);
		expect(after).toHaveLength(2);
	});

	it("cancels the pending rAF when the last subscriber leaves", () => {
		const logger = new EventLogger();
		const unsub = logger.subscribe(() => {});

		logger.push({ event: "x", timestamp: 1 });
		expect(raf.scheduled()).toBe(1);

		unsub();
		expect(raf.scheduled()).toBe(0);
	});

	it("flushes clear() through the same rAF cycle when subscribed", () => {
		const logger = new EventLogger();
		const listener = vi.fn();
		logger.subscribe(listener);

		logger.push({ event: "a", timestamp: 1 });
		raf.flush();
		expect(logger.getSnapshot()).toHaveLength(1);

		logger.clear();
		expect(raf.scheduled()).toBe(1);
		expect(logger.getSnapshot()).toHaveLength(1);

		raf.flush();
		expect(logger.getSnapshot()).toEqual([]);
	});

	it("flushes accumulated entries when the first subscriber arrives", () => {
		const logger = new EventLogger();

		logger.push({ event: "shape:created", timestamp: 1 });
		logger.push({ event: "shape:updated", timestamp: 2 });
		expect(raf.scheduled()).toBe(0);
		expect(logger.getSnapshot()).toEqual([]);

		const listener = vi.fn();
		logger.subscribe(listener);

		expect(raf.scheduled()).toBe(1);
		raf.flush();

		expect(listener).toHaveBeenCalledTimes(1);
		expect(logger.getSnapshot()).toHaveLength(2);
	});

	it("clears synchronously when no one is listening", () => {
		const logger = new EventLogger();
		logger.push({ event: "a", timestamp: 1 });

		logger.clear();

		expect(raf.scheduled()).toBe(0);
		expect(logger.getSnapshot()).toEqual([]);
	});

	it("dispose() cancels the pending rAF and drops listeners", () => {
		const logger = new EventLogger();
		const listener = vi.fn();
		logger.subscribe(listener);
		logger.push({ event: "x", timestamp: 1 });

		logger.dispose();

		expect(raf.scheduled()).toBe(0);
		raf.flush();
		expect(listener).not.toHaveBeenCalled();
	});
});
