import type { MarkdownNode } from "@edv4h/usketch-shared";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkGfm);

/** Parse Markdown source into an mdast root node (GFM enabled). */
export function parseMarkdown(source: string): MarkdownNode {
	return processor.parse(source) as unknown as MarkdownNode;
}

/** Top-level block nodes of a parsed document. */
export function topLevelBlocks(source: string): MarkdownNode[] {
	return parseMarkdown(source).children ?? [];
}

/**
 * Concatenate the plain text of an mdast node (recursively collecting `value`
 * from text/inlineCode/code leaves). Block-level children are joined with
 * newlines so paragraphs/list items stay on separate lines.
 */
export function mdastText(node: MarkdownNode): string {
	if (typeof node.value === "string") return node.value;
	const children = node.children ?? [];
	if (children.length === 0) return "";
	const blockSep = new Set(["paragraph", "listItem", "heading", "blockquote", "tableRow"]);
	return children
		.map((c) => mdastText(c))
		.join(children.some((c) => blockSep.has(c.type)) ? "\n" : "");
}

/**
 * The original Markdown source for a node, sliced via its `position` offsets.
 * Falls back to `mdastText` when positions are unavailable. Best for the
 * markdown-shape fallback so the exact source is preserved for re-rendering.
 */
export function nodeSource(node: MarkdownNode, source: string): string {
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	if (typeof start === "number" && typeof end === "number") {
		return source.slice(start, end);
	}
	return mdastText(node);
}
