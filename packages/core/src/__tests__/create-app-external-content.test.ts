import type {
	BoardStore,
	ExternalContentHandler,
	PluginContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
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

function registeringPlugin(handler: ExternalContentHandler): UsketchPlugin {
	return {
		id: "test-external-content-plugin",
		name: "test external content",
		setup(ctx: PluginContext) {
			return ctx.externalContent.register(handler);
		},
	};
}

describe("createApp — external content integration", () => {
	it("exposes ctx.externalContent on PluginContext so plugins can hook in", async () => {
		const handle = vi.fn();
		const handler: ExternalContentHandler<"url"> = {
			id: "test-url",
			kind: "url",
			order: 0,
			match: () => true,
			handle,
		};
		const app = await createApp({
			store: createStubStore(),
			plugins: [registeringPlugin(handler)],
		});

		expect(app.externalContent.getHandlers().map((h) => h.id)).toEqual(["test-url"]);
		app.destroy();
	});

	it("plugin handlers receive a ctx with the live registry self-reference", async () => {
		let observedCtxRegistryId: unknown = null;
		const handler: ExternalContentHandler<"text"> = {
			id: "text-h",
			kind: "text",
			order: 0,
			match: (_c, ctx) => {
				// match also receives the ctx; verify it carries the registry.
				observedCtxRegistryId = ctx.externalContent.getHandlers()[0]?.id;
				return true;
			},
			handle: vi.fn(),
		};
		const app = await createApp({
			store: createStubStore(),
			plugins: [registeringPlugin(handler)],
		});

		await app.externalContent.dispatch({ kind: "text", via: "drop", text: "hi", html: null });
		expect(observedCtxRegistryId).toBe("text-h");
		app.destroy();
	});

	it("app.externalContent.dispatch invokes the plugin's handler", async () => {
		const handle = vi.fn();
		const handler: ExternalContentHandler<"url"> = {
			id: "test-url",
			kind: "url",
			order: 0,
			match: () => true,
			handle,
		};
		const app = await createApp({
			store: createStubStore(),
			plugins: [registeringPlugin(handler)],
		});

		const dispatched = await app.externalContent.dispatch({
			kind: "url",
			via: "drop",
			url: "https://example.com",
			source: "text",
		});
		expect(dispatched).toBe(true);
		expect(handle).toHaveBeenCalledTimes(1);
		app.destroy();
	});

	it("after destroy(), plugin teardown removes the handler; subsequent dispatch returns false", async () => {
		const handle = vi.fn();
		const handler: ExternalContentHandler<"file"> = {
			id: "f",
			kind: "file",
			order: 0,
			match: () => true,
			handle,
		};
		const app = await createApp({
			store: createStubStore(),
			plugins: [registeringPlugin(handler)],
		});
		app.destroy();

		const dispatched = await app.externalContent.dispatch({
			kind: "file",
			via: "drop",
			files: [new File(["x"], "x.txt")],
		});
		expect(dispatched).toBe(false);
		expect(handle).not.toHaveBeenCalled();
	});

	it("with no plugin registering anything, dispatch returns false", async () => {
		const app = await createApp({ store: createStubStore(), plugins: [] });
		const dispatched = await app.externalContent.dispatch({
			kind: "text",
			via: "paste",
			text: "x",
			html: null,
		});
		expect(dispatched).toBe(false);
		app.destroy();
	});
});
