import {
	DEFAULT_STYLE,
	type ExternalContentHandler,
	type ExternalContentHandlerCtx,
	generateId,
} from "@edv4h/usketch-shared";
import { createAddShapeCommand } from "@edv4h/usketch-store";
import { MARKDOWN_DEFAULT_SIZE } from "./constants.js";
import { htmlHasTable, parseDelimited, parseHtmlTable, toMarkdownTable } from "./table-paste.js";
import { MARKDOWN_TYPE, type MarkdownShapeData } from "./types.js";

/** Internal shape copy/paste marker (from usketch-plugin-keyboard-shortcuts). */
const INTERNAL_SHAPES_FORMAT = "usketch/shapes";

function viewportCenterToWorld(ctx: ExternalContentHandlerCtx): { x: number; y: number } {
	const vp = ctx.store.getViewport();
	const screenW = typeof window !== "undefined" ? window.innerWidth : 0;
	const screenH = typeof window !== "undefined" ? window.innerHeight : 0;
	return { x: (screenW / 2 - vp.x) / vp.zoom, y: (screenH / 2 - vp.y) / vp.zoom };
}

/** Create a markdown shape centered on the viewport and select it (undoable). */
function placeMarkdownShape(ctx: ExternalContentHandlerCtx, source: string): void {
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
		meta: { source, isEditing: false },
	};
	ctx.commands.execute(createAddShapeCommand(ctx.store, shape));
	ctx.store.setSelection([id]);
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
			// Preserve the original text verbatim (rendered as GFM on view; plain
			// text renders as-is). Height auto-fits after render.
			placeMarkdownShape(ctx, content.text);
		},
	};
}

/**
 * Table paste: a spreadsheet selection (Excel / Google Sheets / web `<table>`)
 * or delimited TSV/CSV text becomes a GFM markdown table shape. Registered at a
 * higher `order` than the plain-text catch-all so tabular pastes win; anything
 * non-tabular falls through to {@link createMarkdownTextHandler}.
 */
export function createMarkdownTableHandler(): ExternalContentHandler<"text"> {
	return {
		id: "usketch-plugin-shape-markdown:table",
		kind: "text",
		order: 10,
		match: (content) => {
			if (content.text && isInternalShapesClipboard(content.text.trim())) return false;
			return htmlHasTable(content.html) || parseDelimited(content.text) !== null;
		},
		handle: (content, ctx) => {
			// Prefer the rich HTML table (handles multi-word cells) over delimited text.
			const rows = parseHtmlTable(content.html) ?? parseDelimited(content.text);
			if (!rows) return;
			placeMarkdownShape(ctx, toMarkdownTable(rows));
		},
	};
}
