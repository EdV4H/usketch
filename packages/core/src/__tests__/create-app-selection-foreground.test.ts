import type {
	BoardStore,
	PluginContext,
	SelectionForeground,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
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
		getStyleSettings: () => ({
			fill: "#ffffff",
			stroke: "#1e1e1e",
			strokeWidth: 2,
			opacity: 1,
		}),
		setStyleSettings() {},
		getVisibleShapeIds: () => [],
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		onMutation: () => () => {},
	} as unknown as BoardStore;
}

function defaultPlugin(entry: SelectionForeground): UsketchPlugin {
	let off: (() => void) | undefined;
	return {
		id: "test-default-plugin",
		name: "test default",
		setup(ctx: PluginContext) {
			off = ctx.ui.registerSelectionForeground(entry);
		},
		teardown() {
			off?.();
		},
	};
}

describe("createApp — selection foreground integration", () => {
	it("registers ctx.ui on PluginContext so plugins can hook in", async () => {
		const renderFn = () => null;
		const plugin = defaultPlugin({
			id: "tool-select-default",
			priority: 0,
			render: renderFn,
		});

		const app = await createApp({ store: createStubStore(), plugins: [plugin] });

		expect(app.selectionForeground.getActive()?.id).toBe("tool-select-default");
		expect(app.selectionForeground.getActive()?.render).toBe(renderFn);

		app.destroy();
	});

	it("createApp({ selectionForeground }) wins over a plugin default", async () => {
		const plugin = defaultPlugin({
			id: "tool-select-default",
			priority: 0,
			render: () => null,
		});
		const hostRender = () => null;

		const app = await createApp({
			store: createStubStore(),
			plugins: [plugin],
			selectionForeground: { render: hostRender },
		});

		const active = app.selectionForeground.getActive();
		expect(active?.id).toBe("__app:selectionForeground");
		expect(active?.priority).toBe(100);
		expect(active?.render).toBe(hostRender);

		app.destroy();
	});

	it("createApp({ selectionForeground }) wins on tie against a priority-100 plugin (registered after)", async () => {
		const plugin = defaultPlugin({
			id: "custom-plugin",
			priority: 100,
			render: () => null,
		});
		const hostRender = () => null;

		const app = await createApp({
			store: createStubStore(),
			plugins: [plugin],
			selectionForeground: { render: hostRender },
		});

		// app option is registered after plugin setup, so on equal priority it wins.
		expect(app.selectionForeground.getActive()?.id).toBe("__app:selectionForeground");

		app.destroy();
	});

	it("with no host option and no plugin, getActive() is null", async () => {
		const app = await createApp({ store: createStubStore(), plugins: [] });
		expect(app.selectionForeground.getActive()).toBeNull();
		app.destroy();
	});
});
