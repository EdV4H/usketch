import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { downloadBlob, exportCanvas, exportJson } from "./exporter.js";

export function createExportPlugin(): UsketchPlugin {
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

			const unsub1 = ctx.shortcuts.register("ctrl+shift+e", () => exportImage("png"));
			const unsub2 = ctx.shortcuts.register("ctrl+shift+alt+e", () => exportImage("svg"));
			const unsub3 = ctx.shortcuts.register("ctrl+shift+j", exportJsonFile);

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

			return () => {
				unsub1();
				unsub2();
				unsub3();
				for (const off of offActions) off();
			};
		},
	};
}
