import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { downloadBlob, exportCanvas } from "./exporter.js";

function getCanvasContainer(): HTMLElement | null {
	return document.querySelector<HTMLElement>("[style*='touch-action: none']");
}

export const exportPlugin: UsketchPlugin = {
	id: "usketch-plugin-export",
	name: "エクスポート",

	setup(ctx: PluginContext) {
		ctx.shortcuts.register("ctrl+shift+e", () => {
			const container = getCanvasContainer();
			if (!container) return;
			const shapes = new Map(ctx.store.getShapes());
			exportCanvas(container, shapes, { format: "png" }).then((blob) =>
				downloadBlob(blob, "usketch-export.png"),
			);
		});

		ctx.shortcuts.register("ctrl+shift+alt+e", () => {
			const container = getCanvasContainer();
			if (!container) return;
			const shapes = new Map(ctx.store.getShapes());
			exportCanvas(container, shapes, { format: "svg" }).then((blob) =>
				downloadBlob(blob, "usketch-export.svg"),
			);
		});
	},
};
