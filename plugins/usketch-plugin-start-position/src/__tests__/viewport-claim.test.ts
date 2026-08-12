import type { EventBus } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	claimViewport,
	VIEWPORT_CLAIMED,
	type ViewportClaim,
	watchViewportClaims,
} from "../viewport-claim.js";

/** Minimal synchronous event bus recording handlers per event. */
function fakeBus(): EventBus {
	const handlers = new Map<string, Set<(d: unknown) => void>>();
	return {
		on: (event: string, handler: (d: unknown) => void) => {
			const set = handlers.get(event) ?? new Set();
			set.add(handler);
			handlers.set(event, set);
			return () => set.delete(handler);
		},
		emit: (event: string, data: unknown) => {
			for (const h of handlers.get(event) ?? []) h(data);
		},
		pause: () => {},
		resume: () => {},
		isPaused: () => false,
	} as unknown as EventBus;
}

describe("watchViewportClaims", () => {
	it("does not yield when no other source claims", () => {
		const bus = fakeBus();
		const guard = watchViewportClaims(bus, "start-position", 10);
		expect(guard.shouldYield()).toBe(false);
	});

	it("yields to a higher-priority claim from another source", () => {
		const bus = fakeBus();
		const guard = watchViewportClaims(bus, "start-position", 10);
		claimViewport(bus, "deep-link", 100);
		expect(guard.shouldYield()).toBe(true);
	});

	it("does not yield to a lower-priority claim", () => {
		const bus = fakeBus();
		const guard = watchViewportClaims(bus, "start-position", 100);
		claimViewport(bus, "other", 10);
		expect(guard.shouldYield()).toBe(false);
	});

	it("ignores its own claims (no self-yield)", () => {
		const bus = fakeBus();
		const guard = watchViewportClaims(bus, "start-position", 10);
		claimViewport(bus, "start-position", 10);
		expect(guard.shouldYield()).toBe(false);
	});

	it("yields on an equal-priority claim from another source", () => {
		const bus = fakeBus();
		const guard = watchViewportClaims(bus, "a", 50);
		claimViewport(bus, "b", 50);
		expect(guard.shouldYield()).toBe(true);
	});

	it("emits a well-formed claim on VIEWPORT_CLAIMED", () => {
		const bus = fakeBus();
		let seen: ViewportClaim | null = null;
		bus.on<ViewportClaim>(VIEWPORT_CLAIMED, (c) => {
			seen = c;
		});
		claimViewport(bus, "deep-link", 100);
		expect(seen).toEqual({ source: "deep-link", priority: 100 });
	});

	it("stops tracking after dispose", () => {
		const bus = fakeBus();
		const guard = watchViewportClaims(bus, "start-position", 10);
		guard.dispose();
		claimViewport(bus, "deep-link", 100);
		expect(guard.shouldYield()).toBe(false);
	});
});
