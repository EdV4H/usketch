import type { PluginAction } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createActionRegistry } from "../action-registry.js";

function action(id: string, over: Partial<PluginAction> = {}): PluginAction {
	return { id, label: id, run: () => {}, ...over };
}

describe("createActionRegistry", () => {
	it("register/get/getAll", () => {
		const r = createActionRegistry();
		r.register(action("a"));
		r.register(action("b"));
		expect(r.get("a")?.label).toBe("a");
		expect([...r.getAll().keys()]).toEqual(["a", "b"]);
	});

	it("register returns an unregister; unregister removes and notifies", () => {
		const r = createActionRegistry();
		const listener = vi.fn();
		const off = r.register(action("a"));
		r.subscribe(listener);
		off();
		expect(r.get("a")).toBeUndefined();
		expect(r.getAll().size).toBe(0);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("re-registering the same id updates in place (keeps order once)", () => {
		const r = createActionRegistry();
		r.register(action("a", { label: "first" }));
		r.register(action("b"));
		r.register(action("a", { label: "second" }));
		expect(r.get("a")?.label).toBe("second");
		expect(r.getOrdered().map((e) => e.id)).toEqual(["a", "b"]);
	});

	it("getOrdered sorts by group, then order, then registration order", () => {
		const r = createActionRegistry();
		r.register(action("z-no-group"));
		r.register(action("card-2", { group: "card", order: 2 }));
		r.register(action("card-1", { group: "card", order: 1 }));
		r.register(action("bg", { group: "bg" }));
		expect(r.getOrdered().map((e) => e.id)).toEqual(["bg", "card-1", "card-2", "z-no-group"]);
	});

	it("getOrdered exposes the owning pluginId (registerFor); plain register → undefined", () => {
		const r = createActionRegistry();
		r.registerFor("plugin-a", action("a"));
		r.register(action("b")); // no plugin scope
		const byId = Object.fromEntries(r.getOrdered().map((e) => [e.id, e.pluginId]));
		expect(byId.a).toBe("plugin-a");
		expect(byId.b).toBeUndefined();
	});

	it("unregister clears the pluginId mapping", () => {
		const r = createActionRegistry();
		const off = r.registerFor("plugin-a", action("a"));
		off();
		r.register(action("a")); // re-register without scope
		expect(r.getOrdered().find((e) => e.id === "a")?.pluginId).toBeUndefined();
	});

	it("a stale unregister does not remove a re-registration under the same id", () => {
		const r = createActionRegistry();
		const off1 = r.register(action("a", { label: "first" }));
		r.register(action("a", { label: "second" })); // replace same id
		off1(); // stale unsubscribe
		expect(r.get("a")?.label).toBe("second");
	});

	it("subscribe fires on register and returns an unsubscribe", () => {
		const r = createActionRegistry();
		const listener = vi.fn();
		const off = r.subscribe(listener);
		r.register(action("a"));
		expect(listener).toHaveBeenCalledTimes(1);
		off();
		r.register(action("b"));
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("run invokes the action callback with args", () => {
		const r = createActionRegistry();
		const run = vi.fn();
		r.register(action("a", { run }));
		r.get("a")?.run({ color: "#fff" });
		expect(run).toHaveBeenCalledWith({ color: "#fff" });
	});
});
