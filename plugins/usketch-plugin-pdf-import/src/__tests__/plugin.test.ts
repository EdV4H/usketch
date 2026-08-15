import type { ExternalContentHandler, PluginContext } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createPdfImportPlugin } from "../plugin.js";

function makePluginCtx() {
	const unregister = vi.fn();
	const registerHandler = vi.fn(() => unregister);
	const registerShape = vi.fn();
	const registerLayer = vi.fn();
	const unregisterLayer = vi.fn();
	const get = vi.fn(() => undefined);
	const ctx = {
		store: {} as PluginContext["store"],
		shapes: { register: registerShape },
		layers: { register: registerLayer, unregister: unregisterLayer },
		externalContent: { register: registerHandler },
		services: { get },
	} as unknown as PluginContext;
	return {
		ctx,
		registerHandler,
		registerShape,
		registerLayer,
		unregisterLayer,
		unregister,
		get,
	};
}

describe("createPdfImportPlugin", () => {
	it("registers the pdf-page shape type on setup", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, registerShape } = makePluginCtx();

		plugin.setup?.(ctx);

		expect(registerShape).toHaveBeenCalledTimes(1);
		const [type, definition] = registerShape.mock.calls[0] ?? [];
		expect(type).toBe("pdf-page");
		// A canvas cannot live inside the SVG shape layer.
		expect(definition).toMatchObject({ renderTarget: "html" });
		// Zoomed-out / off-screen pages must not run pdf.js.
		expect(definition).toHaveProperty("simplifiedComponent");
	});

	it("registers a PDF file handler on setup", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, registerHandler } = makePluginCtx();

		plugin.setup?.(ctx);

		expect(registerHandler).toHaveBeenCalledTimes(1);
		const handler = registerHandler.mock.calls[0]?.[0] as unknown as ExternalContentHandler<"file">;
		expect(handler.kind).toBe("file");
		expect(handler.id).toBe("usketch-plugin-pdf-import:pdf-file");
	});

	it("registers the grid toolbar as a screen-fixed overlay layer", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, registerLayer } = makePluginCtx();

		plugin.setup?.(ctx);

		expect(registerLayer).toHaveBeenCalledTimes(1);
		// Screen-space, so the bar keeps its size regardless of zoom.
		expect(registerLayer.mock.calls[0]?.[0]).toMatchObject({
			id: "pdf-import:grid-toolbar",
			fixed: true,
		});
	});

	it("unregisters the handler and the toolbar on teardown", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, unregister, unregisterLayer } = makePluginCtx();

		const teardown = plugin.setup?.(ctx);
		expect(unregister).not.toHaveBeenCalled();

		teardown?.();
		expect(unregister).toHaveBeenCalledTimes(1);
		expect(unregisterLayer).toHaveBeenCalledWith("pdf-import:grid-toolbar");
	});

	it("resolves the asset store lazily, so plugin registration order does not matter", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, get } = makePluginCtx();

		plugin.setup?.(ctx);

		// Nothing looked the store up at setup time; it is read per render instead.
		expect(get).not.toHaveBeenCalled();
	});

	it("passes options through to the handler", () => {
		const plugin = createPdfImportPlugin({ order: 42 });
		const { ctx, registerHandler } = makePluginCtx();

		plugin.setup?.(ctx);

		const handler = registerHandler.mock.calls[0]?.[0] as unknown as ExternalContentHandler<"file">;
		expect(handler.order).toBe(42);
	});
});
