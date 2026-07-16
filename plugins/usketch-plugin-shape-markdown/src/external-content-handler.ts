import {
	DEFAULT_STYLE,
	type ExternalContentHandler,
	type ExternalContentHandlerCtx,
	generateId,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { MARKDOWN_DEFAULT_SIZE } from "./constants.js";
import { MARKDOWN_TYPE, type MarkdownShapeData } from "./types.js";

/** Internal shape copy/paste marker (from usketch-plugin-keyboard-shortcuts). */
const INTERNAL_SHAPES_FORMAT = "usketch/shapes";

function viewportCenterToWorld(ctx: ExternalContentHandlerCtx): { x: number; y: number } {
	const vp = ctx.store.getViewport();
	const screenW = typeof window !== "undefined" ? window.innerWidth : 0;
	const screenH = typeof window !== "undefined" ? window.innerHeight : 0;
	return { x: (screenW / 2 - vp.x) / vp.zoom, y: (screenH / 2 - vp.y) / vp.zoom };
}

/** True when the text is the internal shape-clipboard JSON (don't hijack it). */
function isInternalShapesClipboard(text: string): boolean {
	if (!text.startsWith("{")) return false;
	try {
		const parsed = JSON.parse(text) as { format?: unknown };
		return (
			typeof parsed === "object" && parsed !== null && parsed.format === INTERNAL_SHAPES_FORMAT
		);
	} catch {
		return false;
	}
}

/**
 * External-content handler: paste or drop of plain text creates a markdown
 * shape from the text. Registered at `order: 0` so a host/third-party handler
 * can override. Skips the internal shape-clipboard JSON so Cmd+V of copied
 * shapes still pastes shapes (both the keyboard shortcut and the document
 * `paste` event fire on Cmd+V).
 */
export function createMarkdownTextHandler(): ExternalContentHandler<"text"> {
	return {
		id: "usketch-plugin-shape-markdown:text",
		kind: "text",
		order: 0,
		match: (content) => {
			const text = content.text?.trim();
			if (!text) return false;
			return !isInternalShapesClipboard(text);
		},
		handle: (content, ctx) => {
			const center = viewportCenterToWorld(ctx);
			const id = generateId();
			const shape: MarkdownShapeData = {
				id,
				type: MARKDOWN_TYPE,
				x: Math.round(center.x - MARKDOWN_DEFAULT_SIZE.width / 2),
				y: Math.round(center.y - MARKDOWN_DEFAULT_SIZE.height / 2),
				width: MARKDOWN_DEFAULT_SIZE.width,
				height: MARKDOWN_DEFAULT_SIZE.height,
				style: { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 },
				// Preserve the original text verbatim (rendered as GFM on view;
				// plain text renders as-is). Height auto-fits after render.
				meta: { source: content.text, isEditing: false },
			};
			ctx.commands.execute(createAddShapeCommand(ctx.store, shape));
			ctx.store.setSelection([id]);
		},
	};
}
