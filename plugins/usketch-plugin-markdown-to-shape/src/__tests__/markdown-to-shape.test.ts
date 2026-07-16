import type {
	MarkdownConverter,
	MarkdownConverterRegistry,
	MarkdownNode,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { mdastText, nodeSource, topLevelBlocks } from "../mdast.js";
import { convertMarkdownToShapes } from "../orchestrator.js";

// Minimal registry for orchestrator tests (the real one lives in core).
function makeRegistry(converters: MarkdownConverter[]): MarkdownConverterRegistry {
	return {
		register: () => () => {},
		unregister: () => {},
		getAll: () => converters,
		resolve: (node: MarkdownNode) =>
			converters
				.filter((c) => !c.nodeTypes || c.nodeTypes.includes(node.type))
				.filter((c) => !c.match || c.match(node))
				.sort((a, b) => (b.order ?? 0) - (a.order ?? 0))[0],
	};
}

const shapes = {} as ShapeRegistry;
const origin = { x: 100, y: 50, width: 300 };

const DOC = `# Title

some paragraph

| a | b |
| - | - |
| 1 | 2 |
`;

describe("mdast helpers", () => {
	it("splits a document into top-level blocks", () => {
		const types = topLevelBlocks(DOC).map((n) => n.type);
		expect(types).toEqual(["heading", "paragraph", "table"]);
	});

	it("mdastText extracts plain text of a heading", () => {
		const heading = topLevelBlocks("# Hello **world**")[0];
		expect(mdastText(heading)).toBe("Hello world");
	});

	it("nodeSource slices the raw markdown for a node", () => {
		const src = "# H\n\n- a\n- b\n";
		const list = topLevelBlocks(src).find((n) => n.type === "list") as MarkdownNode;
		expect(nodeSource(list, src)).toBe("- a\n- b");
	});
});

describe("convertMarkdownToShapes", () => {
	const headingToText: MarkdownConverter = {
		id: "h",
		nodeTypes: ["heading"],
		convert: (node) => [{ type: "text", text: mdastText(node), fontSize: 28, height: 40 }],
	};

	it("uses registered converters and falls back to markdown for the rest", () => {
		const out = convertMarkdownToShapes({
			source: DOC,
			origin,
			registry: makeRegistry([headingToText]),
			shapes,
		});
		// heading → text; paragraph + table → markdown fallback.
		expect(out.map((s) => s.type)).toEqual(["text", "markdown", "markdown"]);
		expect((out[0] as { text?: string }).text).toBe("Title");
		// table fallback carries the raw markdown table source.
		expect(String((out[2].meta as { source?: string }).source)).toContain("| a | b |");
	});

	it("all blocks fall back to markdown when nothing is registered", () => {
		const out = convertMarkdownToShapes({
			source: DOC,
			origin,
			registry: makeRegistry([]),
			shapes,
		});
		expect(out.map((s) => s.type)).toEqual(["markdown", "markdown", "markdown"]);
	});

	it("stacks shapes vertically from the origin (increasing y, shared x)", () => {
		const out = convertMarkdownToShapes({
			source: DOC,
			origin,
			registry: makeRegistry([headingToText]),
			shapes,
			gap: 10,
		});
		expect(out.every((s) => s.x === origin.x)).toBe(true);
		expect(out[0].y).toBe(origin.y);
		for (let i = 1; i < out.length; i++) {
			expect(out[i].y).toBeGreaterThan(out[i - 1].y);
		}
		// heading spec height 40 + gap 10 → next starts at 50 + 50 = 100.
		expect(out[1].y).toBe(origin.y + 40 + 10);
	});

	it("skips thematic breaks (horizontal rules)", () => {
		const out = convertMarkdownToShapes({
			source: "para\n\n---\n\nmore",
			origin,
			registry: makeRegistry([]),
			shapes,
		});
		expect(out).toHaveLength(2); // the `---` produced no shape
	});
});
