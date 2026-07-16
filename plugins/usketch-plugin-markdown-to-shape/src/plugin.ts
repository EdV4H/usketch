import type { Command, PluginContext, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { convertMarkdownToShapes } from "./orchestrator.js";

const MARKDOWN_TYPE = "markdown";

/** Read the markdown source off a shape's meta (no dependency on the md plugin). */
function readSource(shape: ShapeData): string {
	const meta = shape.meta as { source?: unknown } | undefined;
	return typeof meta?.source === "string" ? meta.source : "";
}

/**
 * Decomposes a selected `markdown` shape into native shapes using the
 * `ctx.markdownConverters` registry. Ships only the orchestration + a Control
 * HUD action; concrete converters (heading→text, …) are registered elsewhere,
 * so this plugin depends on no shape plugin. Unregistered block types fall back
 * to a `markdown` shape carrying their raw source.
 */
export function createMarkdownToShapePlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-markdown-to-shape",
		name: "Markdown to Shape",

		setup(ctx: PluginContext) {
			const selectedMarkdownId = (): string | null => {
				const sel = ctx.store.getSelection();
				if (sel.size !== 1) return null;
				const id = [...sel][0] as string;
				return ctx.store.getShape(id)?.type === MARKDOWN_TYPE ? id : null;
			};

			const off = ctx.actions.register({
				id: "markdown:explode",
				label: "🧩 Markdown を図形に分解",
				group: "Markdown",
				isEnabled: () => selectedMarkdownId() !== null,
				run: () => {
					const id = selectedMarkdownId();
					if (!id) return;
					const original = ctx.store.getShape(id);
					if (!original) return;
					const source = readSource(original);
					if (source.trim() === "") return;

					const shapes = convertMarkdownToShapes({
						source,
						origin: { x: original.x, y: original.y, width: original.width },
						registry: ctx.markdownConverters,
						shapes: ctx.shapes,
					});
					if (shapes.length === 0) return;

					// One undoable step: replace the markdown shape with the decomposition.
					const command: Command = {
						execute: () => {
							ctx.store.deleteShape(id);
							for (const s of shapes) ctx.store.addShape(s);
							ctx.store.setSelection(shapes.map((s) => s.id));
						},
						undo: () => {
							for (const s of shapes) ctx.store.deleteShape(s.id);
							ctx.store.addShape(original);
							ctx.store.setSelection([id]);
						},
					};
					ctx.commands.execute(command);
				},
			});

			return () => off();
		},
	};
}
