import type {
	BoardStore,
	ExternalContentHandler,
	HudSettingsDescriptor,
	PluginContext,
	ShapeData,
} from "@edv4h/usketch-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPdfImportApi } from "../pdf-import-service.js";
import { COLUMNS_INPUT_DEBOUNCE_MS, createPdfImportPlugin } from "../plugin.js";
import type { PdfPageShapeData } from "../types.js";

function page(pageNumber: number, x: number, y: number): PdfPageShapeData {
	return {
		id: `p${pageNumber}`,
		type: "pdf-page",
		x,
		y,
		width: 100,
		height: 200,
		style: { fill: "#fff", stroke: "#eee", strokeWidth: 1, opacity: 1 },
		assetId: "asset:a",
		pageNumber,
		pageCount: 4,
		fileName: "a.pdf",
		pointWidth: 595,
		pointHeight: 842,
	};
}

/** Four pages in one row, 20 apart, all selected; positions are writable. */
function fakeStore(): BoardStore {
	const shapes = [page(1, 0, 0), page(2, 120, 0), page(3, 240, 0), page(4, 360, 0)];
	const map = new Map<string, ShapeData>(shapes.map((s) => [s.id, s]));
	const listeners = new Set<() => void>();
	return {
		getShapes: () => map,
		getSelection: () => new Set(map.keys()),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const shape = map.get(id);
			if (shape) map.set(id, { ...shape, ...patch });
			for (const listener of listeners) listener();
		},
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	} as unknown as BoardStore;
}

function makePluginCtx() {
	const unregister = vi.fn();
	const registerHandler = vi.fn(() => unregister);
	const registerShape = vi.fn();
	const unregisterAction = vi.fn();
	const registerAction = vi.fn(() => unregisterAction);
	const unregisterSettings = vi.fn();
	const registerSettings = vi.fn(() => unregisterSettings);
	const registerLayer = vi.fn();
	const get = vi.fn(() => undefined);
	const unprovide = vi.fn();
	const provide = vi.fn(() => unprovide);
	const execute = vi.fn((command: { execute(): void }) => command.execute());
	const ctx = {
		store: fakeStore(),
		commands: { execute },
		shapes: { register: registerShape },
		layers: { register: registerLayer },
		actions: { register: registerAction },
		hud: { registerSettings },
		externalContent: { register: registerHandler },
		services: { get, provide },
	} as unknown as PluginContext;
	return {
		ctx,
		registerHandler,
		registerShape,
		registerAction,
		unregisterAction,
		registerSettings,
		unregisterSettings,
		registerLayer,
		unregister,
		get,
		provide,
		unprovide,
		execute,
	};
}

afterEach(() => {
	vi.useRealTimers();
});

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

	it("puts its column controls in the HUD instead of its own overlay layer", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, registerAction, registerSettings, registerLayer } = makePluginCtx();

		plugin.setup?.(ctx);

		expect(registerLayer).not.toHaveBeenCalled();
		const actionIds = registerAction.mock.calls.map(([a]) => (a as { id: string }).id);
		expect(actionIds).toEqual(["pdf-import:set-columns", "pdf-import:square-grid"]);
		expect(registerSettings).toHaveBeenCalledWith(
			expect.objectContaining({ id: "pdf-import:grid" }),
		);
	});

	it("unregisters the handler and every HUD contribution on teardown", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, unregister, unregisterAction, unregisterSettings } = makePluginCtx();

		const teardown = plugin.setup?.(ctx);
		expect(unregister).not.toHaveBeenCalled();

		teardown?.();
		expect(unregister).toHaveBeenCalledTimes(1);
		expect(unregisterAction).toHaveBeenCalledTimes(2);
		expect(unregisterSettings).toHaveBeenCalledTimes(1);
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

	it("publishes its grid operations as a typed service and withdraws them on teardown", () => {
		const plugin = createPdfImportPlugin();
		const { ctx, provide, unprovide, execute } = makePluginCtx();

		const teardown = plugin.setup?.(ctx);

		expect(provide).toHaveBeenCalledTimes(1);
		const [key, api] = provide.mock.calls[0] as unknown as [string, unknown];
		const services = { get: (k: string) => (k === key ? api : undefined) };
		const pdf = getPdfImportApi(services as unknown as PluginContext["services"]);
		expect(pdf?.getSelectedColumns()).toBe(4);
		pdf?.setSelectedColumns(2);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(pdf?.getSelectedColumns()).toBe(2);

		teardown?.();
		expect(unprovide).toHaveBeenCalledTimes(1);
	});

	it("reflows once after the user stops typing in the HUD's column field", () => {
		vi.useFakeTimers();
		const plugin = createPdfImportPlugin();
		const { ctx, registerSettings, execute } = makePluginCtx();
		plugin.setup?.(ctx);
		const settings = registerSettings.mock.calls[0]?.[0] as unknown as HudSettingsDescriptor;
		const listener = vi.fn();
		settings.subscribe(listener);

		// Typing "12" arrives as 1, then 12; with four pages, 1 then 2 stands in for it.
		settings.set("columns", 1);
		expect(settings.get("columns")).toBe(1); // shows what was typed, not the layout
		vi.advanceTimersByTime(COLUMNS_INPUT_DEBOUNCE_MS - 1);
		settings.set("columns", 2);
		vi.advanceTimersByTime(COLUMNS_INPUT_DEBOUNCE_MS - 1);
		expect(execute).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(execute).toHaveBeenCalledTimes(1);
		expect(settings.get("columns")).toBe(2);
		expect(listener).toHaveBeenCalled();
	});

	it("falls back to the real column count when the typed value changes nothing", () => {
		vi.useFakeTimers();
		const plugin = createPdfImportPlugin({ gap: 20 }); // the fake pages sit 20 apart
		const { ctx, registerSettings, execute } = makePluginCtx();
		plugin.setup?.(ctx);
		const settings = registerSettings.mock.calls[0]?.[0] as unknown as HudSettingsDescriptor;
		const listener = vi.fn();
		settings.subscribe(listener);

		settings.set("columns", 4); // already 4 columns
		vi.advanceTimersByTime(COLUMNS_INPUT_DEBOUNCE_MS);

		expect(execute).not.toHaveBeenCalled();
		expect(settings.get("columns")).toBe(4);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("drops a pending column change on teardown", () => {
		vi.useFakeTimers();
		const plugin = createPdfImportPlugin();
		const { ctx, registerSettings, execute } = makePluginCtx();
		const teardown = plugin.setup?.(ctx);
		const settings = registerSettings.mock.calls[0]?.[0] as unknown as HudSettingsDescriptor;

		settings.set("columns", 2);
		teardown?.();
		vi.advanceTimersByTime(COLUMNS_INPUT_DEBOUNCE_MS);

		expect(execute).not.toHaveBeenCalled();
	});
});
