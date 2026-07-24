import type { BoardStore, PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../create-app.js";

function createStubStore(): BoardStore {
	const listeners = new Set<() => void>();
	return {
		getShapes: () => new Map(),
		getShapesSorted: () => [],
		getShape: () => undefined,
		addShape() {},
		updateShape() {},
		deleteShape() {},
		ensureZIndex() {},
		getSelection: () => new Set(),
		setSelection() {},
		addToSelection() {},
		removeFromSelection() {},
		clearSelection() {},
		getActiveToolId: () => "select",
		setActiveToolId() {},
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		setViewport() {},
		panBy() {},
		zoomTo() {},
		fitToBounds() {},
		getStyleSettings: () => ({ fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 }),
		setStyleSettings() {},
		getVisibleShapeIds: () => [],
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation: () => () => {},
	} as unknown as BoardStore;
}

function plugin(id: string, setup: UsketchPlugin["setup"]): UsketchPlugin {
	return { id, name: `${id} name`, setup };
}

describe("createApp — HUD/action plugin attribution", () => {
	it("stamps the owning pluginId on actions and hud contributions", async () => {
		const app = await createApp({
			store: createStubStore(),
			plugins: [
				plugin("plugin-a", (ctx: PluginContext) => {
					ctx.actions.register({ id: "a:do", label: "A", run: () => {} });
					ctx.hud.registerSettings({
						id: "a:settings",
						fields: [{ name: "v", type: "number" }],
						get: () => 1,
						set: () => {},
						subscribe: () => () => {},
					});
				}),
				plugin("plugin-b", (ctx: PluginContext) => {
					ctx.actions.register({ id: "b:do", label: "B", run: () => {} });
					ctx.hud.registerPanel({ id: "b:panel", render: () => null });
				}),
			],
		});

		const actionsByPlugin = Object.fromEntries(
			app.actions.getOrdered().map((e) => [e.id, e.pluginId]),
		);
		expect(actionsByPlugin["a:do"]).toBe("plugin-a");
		expect(actionsByPlugin["b:do"]).toBe("plugin-b");

		expect(app.hud.getSettings().find((e) => e.descriptor.id === "a:settings")?.pluginId).toBe(
			"plugin-a",
		);
		expect(app.hud.getPanels().find((e) => e.panel.id === "b:panel")?.pluginId).toBe("plugin-b");

		app.destroy();
	});

	it("exposes ctx.plugins with active plugin id + name", async () => {
		let observed: readonly { id: string; name: string }[] = [];
		const app = await createApp({
			store: createStubStore(),
			plugins: [
				plugin("p1", () => {}),
				plugin("p2", (ctx: PluginContext) => {
					observed = ctx.plugins.getAll();
				}),
			],
		});
		// p2's setup runs after p1 is registered, so it sees at least p1 + p2.
		expect(observed.map((p) => p.id)).toContain("p1");
		expect(observed.find((p) => p.id === "p1")?.name).toBe("p1 name");
		app.destroy();
	});
});
