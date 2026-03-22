import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { downloadBlob, exportCanvas, exportJson } from "./exporter.js";

export const exportPlugin: UsketchPlugin = {
	id: "usketch-plugin-export",
	name: "エクスポート",

	setup(ctx: PluginContext) {
		const unsub1 = ctx.shortcuts.register("ctrl+shift+e", () => {
			const shapes = new Map(ctx.store.getShapes());
			exportCanvas(shapes, ctx.shapes, { format: "png" })
				.then((blob) => downloadBlob(blob, "usketch-export.png"))
				.catch((e) => console.error("PNG export failed:", e));
		});

		const unsub2 = ctx.shortcuts.register("ctrl+shift+alt+e", () => {
			const shapes = new Map(ctx.store.getShapes());
			exportCanvas(shapes, ctx.shapes, { format: "svg" })
				.then((blob) => downloadBlob(blob, "usketch-export.svg"))
				.catch((e) => console.error("SVG export failed:", e));
		});

		const unsub3 = ctx.shortcuts.register("ctrl+shift+j", () => {
			const shapes = new Map(ctx.store.getShapes());
			const blob = exportJson(shapes);
			downloadBlob(blob, "usketch-export.json");
		});

		(this as unknown as Record<string, unknown>)._cleanup = () => {
			unsub1();
			unsub2();
			unsub3();
		};
	},

	teardown() {
		const cleanup = (this as unknown as Record<string, unknown>)._cleanup as
			| (() => void)
			| undefined;
		cleanup?.();
	},
};
