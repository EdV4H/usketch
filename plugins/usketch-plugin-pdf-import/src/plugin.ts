import { getAssetStore } from "@edv4h/usketch-plugin-asset-store";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createPdfFileHandler } from "./external-content-handler.js";
import { PdfGridToolbar } from "./grid-toolbar.js";
import { setWorkerSrc } from "./pdf-document.js";
import { createPdfPageShapeDefinition } from "./pdf-page-shape.js";
import { PDF_PAGE_SHAPE_TYPE, type PdfImportOptions } from "./types.js";

/** Longest side of a page's render buffer, in device pixels. */
const DEFAULT_MAX_RENDER_SIZE = 4096;
/** Gap between grid cells, in world units. */
const DEFAULT_GAP = 24;
/** Above the shape layers, alongside the other property bars. */
const TOOLBAR_LAYER_ORDER = 83;
const TOOLBAR_LAYER_ID = "pdf-import:grid-toolbar";

/**
 * Expands a pasted or dropped PDF into one live page shape per page.
 *
 * The document is stored once in the asset store and pages are rendered in the
 * browser at the resolution the current zoom needs, so they stay sharp at any
 * zoom level rather than being frozen at import-time resolution.
 *
 * Requires the asset store plugin (`@edv4h/usketch-plugin-asset-store`).
 */
export function createPdfImportPlugin(options: PdfImportOptions = {}): UsketchPlugin {
	const gap = options.gap ?? DEFAULT_GAP;

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
					maxRenderSize: options.maxRenderSize ?? DEFAULT_MAX_RENDER_SIZE,
				}),
			);

			// Column control shown above a multi-page selection. A `fixed` layer
			// rather than a selection foreground — that slot holds a single winner
			// and already belongs to the select tool.
			ctx.layers.register({
				id: TOOLBAR_LAYER_ID,
				order: TOOLBAR_LAYER_ORDER,
				fixed: true,
				render: () => <PdfGridToolbar gap={gap} />,
			});

			const unregisterHandler = ctx.externalContent.register(
				createPdfFileHandler(options, () => getAssetStore(ctx)),
			);

			return () => {
				unregisterHandler();
				ctx.layers.unregister(TOOLBAR_LAYER_ID);
			};
		},
	};
}
