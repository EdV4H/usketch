import type { PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import {
	downloadBlob,
	type ExportPage,
	exportCanvas,
	exportJson,
	exportPagesCanvas,
	exportPagesJson,
} from "./exporter.js";

/** マルチページのボードで「全ページ」を書き出すためのホスト側の読み出し。 */
export interface ExportPagesOptions {
	/** ページを並び順で返す。2 枚以上のときだけ「全ページ」の操作が使える。 */
	list(): { id: string; name: string }[];
	/** ページのシェイプを読む（開いていないページも）。 */
	loadShapes(pageId: string): Promise<Map<string, ShapeData>>;
}

export interface ExportPluginOptions {
	pages?: ExportPagesOptions;
}

/** `pages` の全ページを並び順で読む。 */
export async function loadExportPages(pages: ExportPagesOptions): Promise<ExportPage[]> {
	const list = pages.list();
	const shapes = await Promise.all(list.map((page) => pages.loadShapes(page.id)));
	return list.map((page, i) => ({ id: page.id, name: page.name, shapes: shapes[i] ?? new Map() }));
}

export function createExportPlugin(options: ExportPluginOptions = {}): UsketchPlugin {
	const pages = options.pages;
	return {
		id: "usketch-plugin-export",
		name: "エクスポート",

		setup(ctx: PluginContext) {
			const exportImage = (format: "png" | "svg") => {
				const shapes = new Map(ctx.store.getShapes());
				exportCanvas(shapes, ctx.shapes, { format })
					.then((blob) => downloadBlob(blob, `usketch-export.${format}`))
					.catch((e) => console.error(`${format.toUpperCase()} export failed:`, e));
			};
			const exportJsonFile = () => {
				downloadBlob(exportJson(new Map(ctx.store.getShapes())), "usketch-export.json");
			};

			const unsub1 = ctx.shortcuts.register("Mod+shift+e", () => exportImage("png"));
			const unsub2 = ctx.shortcuts.register("Mod+shift+alt+e", () => exportImage("svg"));
			const unsub3 = ctx.shortcuts.register("Mod+shift+j", exportJsonFile);

			// ── Control HUD 用 Action（Demo の Export メニュー相当） ──
			const offActions = [
				ctx.actions.register({
					id: "export:png",
					label: "Export PNG",
					group: "Export",
					run: () => exportImage("png"),
				}),
				ctx.actions.register({
					id: "export:svg",
					label: "Export SVG",
					group: "Export",
					run: () => exportImage("svg"),
				}),
				ctx.actions.register({
					id: "export:json",
					label: "Export JSON",
					group: "Export",
					run: exportJsonFile,
				}),
			];

			if (pages) {
				const multiPage = () => pages.list().length > 1;
				const exportAll = (format: "png" | "svg" | "json") => {
					loadExportPages(pages)
						.then(async (all) => {
							const blob =
								format === "json"
									? exportPagesJson(all)
									: await exportPagesCanvas(all, ctx.shapes, { format });
							downloadBlob(blob, `usketch-export-pages.${format}`);
						})
						.catch((e) => console.error(`All-pages ${format.toUpperCase()} export failed:`, e));
				};
				offActions.push(
					ctx.actions.register({
						id: "export:pages-png",
						label: "Export PNG（全ページ）",
						group: "Export",
						isEnabled: multiPage,
						run: () => exportAll("png"),
					}),
					ctx.actions.register({
						id: "export:pages-svg",
						label: "Export SVG（全ページ）",
						group: "Export",
						isEnabled: multiPage,
						run: () => exportAll("svg"),
					}),
					ctx.actions.register({
						id: "export:pages-json",
						label: "Export JSON（全ページ）",
						group: "Export",
						isEnabled: multiPage,
						run: () => exportAll("json"),
					}),
				);
			}

			return () => {
				unsub1();
				unsub2();
				unsub3();
				for (const off of offActions) off();
			};
		},
	};
}
