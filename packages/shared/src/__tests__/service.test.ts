import { describe, expect, it } from "vitest";
import { defineService } from "../service.js";
import type { ServiceRegistry } from "../types/plugin.js";

/** Minimal in-memory ServiceRegistry (mirrors packages/core's implementation). */
function fakeServices(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide: <T>(key: string, service: T) => {
			map.set(key, service);
			return () => {
				if (map.get(key) === service) map.delete(key);
			};
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key: string) => map.has(key),
	};
}

interface DemoApi {
	ping(): string;
}

describe("defineService", () => {
	it("round-trips a typed service through provide/get", () => {
		const services = fakeServices();
		const demo = defineService<DemoApi>("demo");
		expect(demo.key).toBe("demo");
		expect(demo.get(services)).toBeUndefined();
		expect(demo.has(services)).toBe(false);

		demo.provide(services, { ping: () => "pong" });
		expect(demo.has(services)).toBe(true);
		expect(demo.get(services)?.ping()).toBe("pong");
	});

	it("returns undefined when the providing plugin is absent (optional)", () => {
		const demo = defineService<DemoApi>("demo");
		expect(demo.get(fakeServices())).toBeUndefined();
	});

	it("unprovide removes the service", () => {
		const services = fakeServices();
		const demo = defineService<DemoApi>("demo");
		const off = demo.provide(services, { ping: () => "pong" });
		off();
		expect(demo.get(services)).toBeUndefined();
	});

	it("the same handle works for two registries (ctx.services vs app.services)", () => {
		// In createApp these are the same object; the accessor must be registry-agnostic.
		const a = fakeServices();
		const demo = defineService<DemoApi>("demo");
		demo.provide(a, { ping: () => "a" });
		expect(demo.get(a)?.ping()).toBe("a");
		expect(demo.get(fakeServices())).toBeUndefined();
	});
});
