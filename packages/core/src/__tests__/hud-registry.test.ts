import type { HudPanel, HudSettingsDescriptor, HudStatus } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createHudRegistry } from "../hud-registry.js";

function descriptor(id: string, over: Partial<HudSettingsDescriptor> = {}): HudSettingsDescriptor {
	return {
		id,
		fields: [{ name: "v", type: "number" }],
		get: () => 0,
		set: () => {},
		subscribe: () => () => {},
		...over,
	};
}

function panel(id: string, over: Partial<HudPanel> = {}): HudPanel {
	return { id, render: () => null, ...over };
}

describe("createHudRegistry", () => {
	it("registerSettings/registerPanel expose entries (pluginId undefined without scope)", () => {
		const r = createHudRegistry();
		r.registerSettings(descriptor("s1"));
		r.registerPanel(panel("p1"));
		expect(r.getSettings().map((e) => [e.pluginId, e.descriptor.id])).toEqual([[undefined, "s1"]]);
		expect(r.getPanels().map((e) => [e.pluginId, e.panel.id])).toEqual([[undefined, "p1"]]);
	});

	it("registerSettingsFor/registerPanelFor stamp the owning pluginId", () => {
		const r = createHudRegistry();
		r.registerSettingsFor("plugin-a", descriptor("s1"));
		r.registerPanelFor("plugin-b", panel("p1"));
		expect(r.getSettings()[0].pluginId).toBe("plugin-a");
		expect(r.getPanels()[0].pluginId).toBe("plugin-b");
	});

	it("sorts by order", () => {
		const r = createHudRegistry();
		r.registerSettings(descriptor("late", { order: 2 }));
		r.registerSettings(descriptor("early", { order: 1 }));
		expect(r.getSettings().map((e) => e.descriptor.id)).toEqual(["early", "late"]);
	});

	it("register returns an unregister that removes the entry and notifies", () => {
		const r = createHudRegistry();
		const listener = vi.fn();
		const off = r.registerSettings(descriptor("s1"));
		r.subscribe(listener);
		off();
		expect(r.getSettings()).toHaveLength(0);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("a stale unregister does not remove a re-registration under the same id", () => {
		const r = createHudRegistry();
		const off1 = r.registerSettings(descriptor("s1", { label: "first" }));
		r.registerSettings(descriptor("s1", { label: "second" }));
		off1(); // stale: s1 was already replaced
		expect(r.getSettings()).toHaveLength(1);
		expect(r.getSettings()[0].descriptor.label).toBe("second");
	});

	it("re-registering the same id replaces without duplicating order", () => {
		const r = createHudRegistry();
		r.registerSettings(descriptor("s1", { label: "one" }));
		r.registerSettings(descriptor("s1", { label: "two" }));
		expect(r.getSettings()).toHaveLength(1);
		expect(r.getSettings()[0].descriptor.label).toBe("two");
	});

	it("statuses are ordered, attributed, and removed by their own unsubscribe", () => {
		const r = createHudRegistry();
		const status = (id: string, order?: number): HudStatus => ({
			id,
			order,
			get: () => null,
			subscribe: () => () => {},
		});
		const offB = r.registerStatusFor("b", status("b", 2));
		r.registerStatus(status("a", 1));
		expect(r.getStatuses().map((e) => [e.pluginId, e.status.id])).toEqual([
			[undefined, "a"],
			["b", "b"],
		]);
		offB();
		expect(r.getStatuses().map((e) => e.status.id)).toEqual(["a"]);
	});

	it("opens, toggles and closes only side panels, and notifies", () => {
		const r = createHudRegistry();
		r.registerPanel(panel("dock"));
		const offSide = r.registerPanel(panel("chat", { placement: "side" }));
		r.registerPanel(panel("ai", { placement: "side" }));
		const listener = vi.fn();
		r.subscribe(listener);

		r.openSidePanel("dock");
		r.openSidePanel("missing");
		expect(r.getOpenSidePanel()).toBeNull();
		expect(listener).not.toHaveBeenCalled();

		r.openSidePanel("chat");
		expect(r.getOpenSidePanel()).toBe("chat");
		r.toggleSidePanel("ai");
		expect(r.getOpenSidePanel()).toBe("ai");
		r.toggleSidePanel("ai");
		expect(r.getOpenSidePanel()).toBeNull();
		r.openSidePanel("chat");
		r.closeSidePanel();
		expect(r.getOpenSidePanel()).toBeNull();
		expect(listener).toHaveBeenCalledTimes(5);

		// An open side panel that unregisters closes.
		r.openSidePanel("chat");
		offSide();
		expect(r.getOpenSidePanel()).toBeNull();
	});
});
