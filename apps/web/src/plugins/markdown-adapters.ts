import {
	createMermaidFlowchartConverter,
	getMarkdownConverters,
	mdastText,
	nodeSource,
} from "@edv4h/usketch-plugin-markdown-to-shape";
import type {
	MarkdownConverter,
	MarkdownNode,
	PluginContext,
	UsketchPlugin,
} from "@edv4h/usketch-shared";

/**
 * App-level adapters that register `markdown → shape` converters into the
 * registry the markdown-to-shape plugin provides on `ctx.services`. Kept in the
 * host app so that plugin stays free of any concrete shape dependency (IoC).
 * Targets the built-in `text` shape; block types with no converter (table /
 * code / mermaid) fall back to a `markdown` shape in the orchestrator.
 *
 * Requires the markdown-to-shape plugin to be registered *before* this adapter
 * (so the service is provided first) — see the plugin order in `app.tsx`.
 */

const FONT = "system-ui, sans-serif";

/** Rough content-height estimate for the created text shape (px). */
function estimateHeight(text: string, fontSize: number, width = 300): number {
	const charsPerLine = Math.max(8, Math.floor(width / (fontSize * 0.55)));
	const lines = text
		.split("\n")
		.reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
	return Math.round(lines * fontSize * 1.5 + 12);
}

function textSpec(text: string, fontSize: number) {
	return {
		type: "text",
		text,
		fontSize,
		fontFamily: FONT,
		isEditing: false,
		height: estimateHeight(text, fontSize),
	};
}

const HEADING_FONT_SIZE: Record<number, number> = { 1: 30, 2: 24, 3: 20, 4: 18, 5: 16, 6: 15 };

const headingToText: MarkdownConverter = {
	id: "app:heading-to-text",
	nodeTypes: ["heading"],
	convert: (node: MarkdownNode) => {
		const depth = typeof node.depth === "number" ? node.depth : 1;
		return [textSpec(mdastText(node), HEADING_FONT_SIZE[depth] ?? 16)];
	},
};

const paragraphToText: MarkdownConverter = {
	id: "app:paragraph-to-text",
	nodeTypes: ["paragraph"],
	convert: (node: MarkdownNode) => [textSpec(mdastText(node), 16)],
};

// Lists / blockquotes keep their raw markdown text (bullets, `>`), which reads
// clearly as plain text. The convert ctx carries the full source for slicing.
const listToText: MarkdownConverter = {
	id: "app:list-to-text",
	nodeTypes: ["list"],
	convert: (node, cctx) => [textSpec(nodeSource(node, cctx.source), 15)],
};

const blockquoteToText: MarkdownConverter = {
	id: "app:blockquote-to-text",
	nodeTypes: ["blockquote"],
	convert: (node, cctx) => [textSpec(nodeSource(node, cctx.source), 15)],
};

export function createMarkdownAdaptersPlugin(): UsketchPlugin {
	return {
		id: "usketch-app-markdown-adapters",
		name: "Markdown Converters (app)",
		setup(ctx: PluginContext) {
			const registry = getMarkdownConverters(ctx);
			if (!registry) {
				console.warn(
					"[markdown-adapters] markdown-converters service not found — is the markdown-to-shape plugin registered before this adapter?",
				);
				return;
			}
			const offs = [
				headingToText,
				paragraphToText,
				listToText,
				blockquoteToText,
				createMermaidFlowchartConverter(),
			].map((c) => registry.register(c));
			return () => {
				for (const off of offs) off();
			};
		},
	};
}
