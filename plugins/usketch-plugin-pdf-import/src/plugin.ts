import { getAssetStore } from "@edv4h/usketch-plugin-asset-store";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createPdfFileHandler, PDF_IMPORT_DEFAULTS } from "./external-content-handler.js";
import { selectedPdfPages } from "./grid-control.js";
import { setWorkerSrc } from "./pdf-document.js";
import { createPdfImportApi, pdfImportService } from "./pdf-import-service.js";
import { createPdfPageShapeDefinition } from "./pdf-page-shape.js";
import { PDF_PAGE_SHAPE_TYPE, type PdfImportOptions } from "./types.js";

/**
 * Area cap of a page's render buffer, in device pixels. ≈32MB at 4 bytes per
 * pixel — a third of the bitmap cache budget, and well under the canvas area
 * limit of iOS Safari (~16.7M px).
 */
const DEFAULT_MAX_RENDER_PIXELS = 8_000_000;

/**
 * How long the HUD's column field waits for typing to stop before reflowing.
 * The HUD applies a number field on every keystroke, so without this typing
 * "12" would reflow to 1 column and then to 12, leaving two undo steps.
 */
export const COLUMNS_INPUT_DEBOUNCE_MS = 400;

/**
 * Expands a pasted or dropped PDF into one live page shape per page.
 *
 * The document is stored once in the asset store and pages are rendered in the
 * browser at the resolution the current zoom needs, so they stay sharp at any
 * zoom level rather than being frozen at import-time resolution.
 *
 * Requires the asset store plugin (`@edv4h/usketch-plugin-asset-store`) and a
 * self-hosted pdf.js worker (`workerSrc`).
 */
export function createPdfImportPlugin(options: PdfImportOptions = {}): UsketchPlugin {
	const gap = options.gap ?? PDF_IMPORT_DEFAULTS.gap;

	return {
		id: "usketch-plugin-pdf-import",
		name: "PDF取り込み",

		setup(ctx: PluginContext) {
			setWorkerSrc(options.workerSrc);

			ctx.shapes.register(
				PDF_PAGE_SHAPE_TYPE,
				createPdfPageShapeDefinition({
					store: ctx.store,
					// Resolved per render rather than here, so this plugin can be
					// registered before the one that provides the store.
					getAssets: () => getAssetStore(ctx),
					maxRenderPixels: options.maxRenderPixels ?? DEFAULT_MAX_RENDER_PIXELS,
				}),
			);

			const unregisterHandler = ctx.externalContent.register(
				createPdfFileHandler(options, () => getAssetStore(ctx)),
			);

			const api = createPdfImportApi(ctx.store, ctx.commands, gap);
			const unprovide = pdfImportService.provide(ctx.services, api);

			// Column controls live in the HUD: plugins must not ship their own
			// toolbars. Move these to a selection-contextual HUD slot once it exists.
			const hasGrid = () => selectedPdfPages(ctx.store).length >= 2;

			const unregisterSetColumns = ctx.actions.register({
				id: "pdf-import:set-columns",
				label: "列数を変更",
				group: "PDF",
				params: [{ name: "columns", label: "列数", type: "number", min: 1, step: 1, default: 2 }],
				isEnabled: hasGrid,
				run: ({ columns }) => api.setSelectedColumns(Number(columns)),
			});
			const unregisterSquare = ctx.actions.register({
				id: "pdf-import:square-grid",
				label: "正方形に近い並びに戻す",
				group: "PDF",
				isEnabled: hasGrid,
				run: () => api.resetSelectedToSquareGrid(),
			});

			// While the user is typing, show what they typed rather than the
			// current arrangement, and reflow once they stop.
			let pendingColumns: number | undefined;
			let pendingTimer: ReturnType<typeof setTimeout> | undefined;
			const fieldListeners = new Set<() => void>();
			const unregisterSettings = ctx.hud.registerSettings({
				id: "pdf-import:grid",
				label: "選択中のPDFページ（2枚以上）",
				fields: [{ name: "columns", label: "列数", type: "number", min: 1, step: 1 }],
				get: (name) =>
					name === "columns" ? (pendingColumns ?? api.getSelectedColumns()) : undefined,
				set: (name, value) => {
					if (name !== "columns") return;
					pendingColumns = Number(value);
					clearTimeout(pendingTimer);
					pendingTimer = setTimeout(() => {
						const columns = pendingColumns;
						pendingColumns = undefined;
						if (columns !== undefined) api.setSelectedColumns(columns);
						// The reflow may be a no-op, so re-read the real value explicitly.
						for (const listener of fieldListeners) listener();
					}, COLUMNS_INPUT_DEBOUNCE_MS);
				},
				// Selection and page positions both live in the store.
				subscribe: (listener) => {
					fieldListeners.add(listener);
					const unsubscribe = ctx.store.subscribe(listener);
					return () => {
						fieldListeners.delete(listener);
						unsubscribe();
					};
				},
			});

			return () => {
				clearTimeout(pendingTimer);
				unprovide();
				unregisterHandler();
				unregisterSetColumns();
				unregisterSquare();
				unregisterSettings();
			};
		},
	};
}
