// The PDF import plugin's host-facing API, published on the `ctx.services` seam
// so a host can rearrange PDF pages from its own UI without the Control HUD. The
// HUD settings and actions call this same API, so every entry point yields the
// same result and the same undo step.
import {
	type BoardStore,
	type CommandRegistry,
	defineService,
	type ServiceRegistry,
} from "@edv4h/usketch-shared";
import {
	createSetPdfColumnsCommand,
	getSelectedPdfColumns,
	selectedPdfPages,
	squareColumns,
} from "./grid-control.js";

/** Grid operations on the PDF pages in the current selection. */
export interface PdfImportApi {
	/** Columns the selected pages are laid out in, or 0 when fewer than two are selected. */
	getSelectedColumns(): number;
	/** Rearrange the selected pages into `columns`, as one undoable command. */
	setSelectedColumns(columns: number): void;
	/** Rearrange the selected pages into the roughly square grid a fresh import gets. */
	resetSelectedToSquareGrid(): void;
}

/** Typed service handle for the PDF import API. Get it via {@link getPdfImportApi}. */
export const pdfImportService = defineService<PdfImportApi>("usketch-plugin-pdf-import");

/** Build the API bound to one board (called in the plugin's setup). */
export function createPdfImportApi(
	store: BoardStore,
	commands: CommandRegistry,
	gap: number,
): PdfImportApi {
	const setSelectedColumns = (columns: number) => {
		const command = createSetPdfColumnsCommand(store, columns, gap);
		if (command) commands.execute(command);
	};
	return {
		getSelectedColumns: () => getSelectedPdfColumns(store),
		setSelectedColumns,
		resetSelectedToSquareGrid: () =>
			setSelectedColumns(squareColumns(selectedPdfPages(store).length)),
	};
}

/**
 * Host accessor: `getPdfImportApi(app.services)?.setSelectedColumns(4)`. Returns
 * `undefined` when the PDF import plugin isn't active. Works with `ctx.services` too.
 */
export function getPdfImportApi(services: ServiceRegistry): PdfImportApi | undefined {
	return pdfImportService.get(services);
}
