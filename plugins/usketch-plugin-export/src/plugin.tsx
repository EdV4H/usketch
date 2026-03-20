import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { downloadBlob, exportCanvas } from "./exporter.js";

export const exportPlugin: UsketchPlugin = {
	id: "usketch-plugin-export",
	name: "エクスポート",

	setup(ctx: PluginContext) {
		ctx.shortcuts.register("ctrl+shift+e", () => {
			const shapes = new Map(ctx.store.getShapes());
			exportCanvas(shapes, { format: "png" }).then((blob) =>
				downloadBlob(blob, "usketch-export.png"),
			);
		});

		ctx.shortcuts.register("ctrl+shift+alt+e", () => {
			const shapes = new Map(ctx.store.getShapes());
			exportCanvas(shapes, { format: "svg" }).then((blob) =>
				downloadBlob(blob, "usketch-export.svg"),
			);
		});
	},
};
