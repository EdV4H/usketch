import type {
	ExternalContentHandler,
	ExternalContentHandlerCtx,
	ShapeData,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { type EmbedDefinition, resolveEmbed } from "./embed-defs.js";
import type { EmbedShapeData } from "./types.js";

/** World point at the current viewport center (place dropped/pasted embeds there). */
function viewportCenter(ctx: ExternalContentHandlerCtx): { x: number; y: number } {
	const vp = ctx.store.getViewport();
	const w = typeof window !== "undefined" ? window.innerWidth : 0;
	const h = typeof window !== "undefined" ? window.innerHeight : 0;
	return { x: (w / 2 - vp.x) / vp.zoom, y: (h / 2 - vp.y) / vp.zoom };
}

/**
 * `kind:"url"` handler: paste/drop an http(s) URL → create an embed shape at the
 * viewport center. Registered at `order: 0` (lowest) so a more specific URL
 * handler could win. Uses the provider's aspect ratio to size the shape.
 */
export function createEmbedUrlHandler(
	getDefs: () => EmbedDefinition[],
): ExternalContentHandler<"url"> {
	return {
		id: "usketch-plugin-shape-embed:url",
		kind: "url",
		order: 0,
		match: (content) => resolveEmbed(content.url, getDefs()) !== null,
		handle: (content, ctx) => {
			const resolved = resolveEmbed(content.url, getDefs());
			if (!resolved) return;
			const aspect = resolved.def.aspect ?? 16 / 9;
			const width = 560;
			const height = Math.round(width / aspect) + 28; // + header
			const c = viewportCenter(ctx);
			const id = generateId();
			const shape: EmbedShapeData = {
				id,
				type: "embed",
				x: Math.round(c.x - width / 2),
				y: Math.round(c.y - height / 2),
				width,
				height,
				style: { fill: "#000000", stroke: "#334155", strokeWidth: 1, opacity: 1 },
				url: content.url,
				provider: resolved.def.id,
				isActive: false,
				syncMode: "free",
			};
			ctx.commands.execute({
				execute: () => {
					ctx.store.addShape(shape as ShapeData);
					ctx.store.setSelection([id]);
				},
				undo: () => ctx.store.deleteShape(id),
			});
		},
	};
}
