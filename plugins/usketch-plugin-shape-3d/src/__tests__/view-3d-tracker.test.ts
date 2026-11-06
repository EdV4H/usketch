import {
	type EventBus,
	type ServiceRegistry,
	type View3dApi,
	view3dService,
} from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createView3dTracker, STAGE_3D_EVENT } from "../view-3d-tracker.js";

function registry(): ServiceRegistry {
	const m = new Map<string, unknown>();
	return {
		provide: (key, service) => {
			m.set(key, service);
			return () => m.delete(key);
		},
		get: <T>(key: string) => m.get(key) as T | undefined,
		has: (key) => m.has(key),
	};
}

function bus(): EventBus & { fire(name: string): void } {
	const handlers = new Map<string, Set<(d: unknown) => void>>();
	return {
		on: (name: string, h: (d: unknown) => void) => {
			let set = handlers.get(name);
			if (!set) {
				set = new Set();
				handlers.set(name, set);
			}
			set.add(h);
			return () => set?.delete(h);
		},
		emit: () => {},
		fire(name: string) {
			for (const h of handlers.get(name) ?? []) h({ active: true });
		},
	} as unknown as EventBus & { fire(name: string): void };
}

function fakeView(): View3dApi & { set(amount: number, yaw: number): void } {
	let amount = 0;
	let yaw = 0;
	const listeners = new Set<() => void>();
	return {
		amount: () => amount,
		camera: () => ({ pitch: 55 * amount, yaw: yaw * amount, fov: 600, horizon: 0.5 }),
		subscribe: (l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		set(a, y) {
			amount = a;
			yaw = y;
			for (const l of listeners) l();
		},
	};
}

describe("createView3dTracker", () => {
	it("is flat without a provider", () => {
		const t = createView3dTracker(registry(), bus());
		expect(t.get()).toEqual({ amount: 0, yaw: 0 });
	});

	it("finds a provider set up later and follows it, recovering the full yaw", async () => {
		const services = registry();
		const events = bus();
		const t = createView3dTracker(services, events);
		const view = fakeView();
		view3dService.provide(services, view);
		events.fire(STAGE_3D_EVENT);
		const listener = vi.fn();
		t.subscribe(listener);
		view.set(0.5, 40);
		expect(t.get()).toEqual({ amount: 0.5, yaw: 40 });
		expect(listener).toHaveBeenCalledTimes(1);
		const before = t.get();
		view.set(0.5, 40);
		expect(t.get()).toBe(before); // unchanged → same snapshot, no notify
		expect(listener).toHaveBeenCalledTimes(1);
		t.dispose();
		view.set(1, 40);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("looks up the provider after setup on its own", async () => {
		const services = registry();
		const view = fakeView();
		view.set(1, 10);
		const t = createView3dTracker(services, bus());
		view3dService.provide(services, view);
		await Promise.resolve();
		expect(t.get()).toEqual({ amount: 1, yaw: 10 });
	});

	it("tells camera listeners about every change, also from a provider set up later", () => {
		const services = registry();
		const events = bus();
		const t = createView3dTracker(services, events);
		const listener = vi.fn();
		t.subscribeCamera(listener); // before any provider exists
		const view = fakeView();
		view3dService.provide(services, view);
		events.fire(STAGE_3D_EVENT);
		expect(listener).toHaveBeenCalledTimes(1); // the provider appearing
		view.set(0.5, 40);
		view.set(0.5, 40); // unchanged amount / yaw still notifies (e.g. the pitch moved)
		expect(listener).toHaveBeenCalledTimes(3);
		t.dispose();
		view.set(1, 40);
		expect(listener).toHaveBeenCalledTimes(3);
	});
});
