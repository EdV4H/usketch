import { describe, expect, it } from "vitest";
import { createServiceRegistry } from "../service-registry.js";

describe("createServiceRegistry", () => {
	it("provides and gets a service by key", () => {
		const reg = createServiceRegistry();
		expect(reg.has("svc")).toBe(false);
		expect(reg.get("svc")).toBeUndefined();

		const svc = { hello: () => "world" };
		reg.provide("svc", svc);
		expect(reg.has("svc")).toBe(true);
		expect(reg.get<typeof svc>("svc")).toBe(svc);
	});

	it("re-providing replaces the service", () => {
		const reg = createServiceRegistry();
		const a = { v: 1 };
		const b = { v: 2 };
		reg.provide("k", a);
		reg.provide("k", b);
		expect(reg.get("k")).toBe(b);
	});

	it("unprovide removes only the current instance", () => {
		const reg = createServiceRegistry();
		const a = { v: 1 };
		const off = reg.provide("k", a);
		off();
		expect(reg.has("k")).toBe(false);

		// A stale unprovide (after a newer provide) must not delete the new one.
		const b = { v: 2 };
		const offA = reg.provide("k", a);
		reg.provide("k", b); // replaces a with b
		offA(); // stale: a is no longer current → no-op
		expect(reg.get("k")).toBe(b);
	});
});
