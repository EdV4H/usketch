import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../event-bus.js";

describe("createEventBus", () => {
	it("delivers emitted events to registered handlers", () => {
		const bus = createEventBus();
		const handler = vi.fn();
		bus.on<{ value: number }>("test:event", handler);

		bus.emit("test:event", { value: 1 });

		expect(handler).toHaveBeenCalledExactlyOnceWith({ value: 1 });
	});

	it("returns an unsubscribe function from on()", () => {
		const bus = createEventBus();
		const handler = vi.fn();
		const unsub = bus.on("test:event", handler);

		bus.emit("test:event", undefined);
		expect(handler).toHaveBeenCalledTimes(1);

		unsub();
		bus.emit("test:event", undefined);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	describe("pause / resume / isPaused", () => {
		it("defaults to not paused", () => {
			const bus = createEventBus();
			expect(bus.isPaused()).toBe(false);
		});

		it("suppresses emit while paused", () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("test:event", handler);

			bus.pause();
			expect(bus.isPaused()).toBe(true);

			bus.emit("test:event", undefined);
			bus.emit("test:event", undefined);

			expect(handler).not.toHaveBeenCalled();
		});

		it("resumes delivery after resume()", () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("test:event", handler);

			bus.pause();
			bus.emit("test:event", "dropped");
			bus.resume();
			expect(bus.isPaused()).toBe(false);

			bus.emit("test:event", "delivered");

			expect(handler).toHaveBeenCalledExactlyOnceWith("delivered");
		});

		it("allows on() while paused and delivers to it after resume", () => {
			const bus = createEventBus();
			const handler = vi.fn();

			bus.pause();
			bus.on("test:event", handler);
			bus.emit("test:event", "dropped");
			expect(handler).not.toHaveBeenCalled();

			bus.resume();
			bus.emit("test:event", "delivered");

			expect(handler).toHaveBeenCalledExactlyOnceWith("delivered");
		});

		it("nests pause/resume safely via ref counting", () => {
			const bus = createEventBus();
			const handler = vi.fn();
			bus.on("test:event", handler);

			bus.pause();
			bus.pause();
			expect(bus.isPaused()).toBe(true);

			bus.resume();
			// Inner caller resumed, but outer caller still holds a pause —
			// delivery must stay suspended.
			expect(bus.isPaused()).toBe(true);
			bus.emit("test:event", "still-dropped");
			expect(handler).not.toHaveBeenCalled();

			bus.resume();
			expect(bus.isPaused()).toBe(false);
			bus.emit("test:event", "delivered");
			expect(handler).toHaveBeenCalledExactlyOnceWith("delivered");
		});

		it("ignores resume() calls past zero with a warning", () => {
			const bus = createEventBus();
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

			bus.resume();
			expect(bus.isPaused()).toBe(false);
			expect(warn).toHaveBeenCalledOnce();

			bus.pause();
			bus.resume();
			bus.resume();
			expect(bus.isPaused()).toBe(false);
			expect(warn).toHaveBeenCalledTimes(2);

			warn.mockRestore();
		});
	});
});
