import type { MarkdownConverterContext, MarkdownNode, ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createMermaidFlowchartConverter, parseFlowchart } from "../mermaid-flowchart.js";

describe("parseFlowchart", () => {
	it("parses nodes (with labels/shapes) and edges", () => {
		const chart = parseFlowchart("graph TD\nA[Start] --> B{Decision}\nB --> C");
		expect(chart).not.toBeNull();
		expect(chart?.direction).toBe("TB");
		expect(chart?.nodes.get("A")).toEqual({ label: "Start", shape: "rect" });
		// `{...}` → decision diamond; the later `B --> C` reference keeps it.
		expect(chart?.nodes.get("B")).toEqual({ label: "Decision", shape: "diamond" });
		expect(chart?.nodes.get("C")).toEqual({ label: "C", shape: "rect" }); // id-only
		expect(chart?.edges).toEqual([
			{ source: "A", target: "B", label: undefined },
			{ source: "B", target: "C", label: undefined },
		]);
	});

	it("maps wrapper syntax to node shapes", () => {
		const chart = parseFlowchart(
			"flowchart TD\nA(round) --> B((circle)) --> C{diamond} --> D[rect]",
		);
		expect(chart?.nodes.get("A")?.shape).toBe("round");
		expect(chart?.nodes.get("B")?.shape).toBe("circle");
		expect(chart?.nodes.get("C")?.shape).toBe("diamond");
		expect(chart?.nodes.get("D")?.shape).toBe("rect");
	});

	it("handles chains and edge labels", () => {
		const chart = parseFlowchart("flowchart LR\nA -->|yes| B --> C");
		expect(chart?.direction).toBe("LR");
		expect(chart?.edges).toEqual([
			{ source: "A", target: "B", label: "yes" },
			{ source: "B", target: "C", label: undefined },
		]);
	});

	it("returns null for non-flowchart diagrams", () => {
		expect(parseFlowchart("sequenceDiagram\nAlice->>Bob: hi")).toBeNull();
		expect(parseFlowchart("")).toBeNull();
	});
});

describe("createMermaidFlowchartConverter", () => {
	const converter = createMermaidFlowchartConverter();
	const ctx: MarkdownConverterContext = {
		source: "",
		shapes: {} as ShapeRegistry,
		origin: { x: 100, y: 50 },
	};
	const codeNode = (value: string, lang = "mermaid"): MarkdownNode => ({
		type: "code",
		lang,
		value,
	});

	it("only matches mermaid code blocks", () => {
		expect(converter.match?.(codeNode("graph TD\nA-->B"))).toBe(true);
		expect(converter.match?.(codeNode("const x = 1", "ts"))).toBe(false);
	});

	it("emits one geo node (with its label) per node and connectors wired by node id", () => {
		const specs = converter.convert(codeNode("graph TD\nA[Start] --> B[End]"), ctx);
		const rects = specs.filter((s) => s.type === "rectangle");
		const texts = specs.filter((s) => s.type === "text");
		const connectors = specs.filter((s) => s.type === "connector");
		expect(rects).toHaveLength(2);
		expect(texts).toHaveLength(0); // label rides on the geo shape, no separate text shape
		expect(connectors).toHaveLength(1);
		// The node carries its label natively (centered geo label).
		expect(rects.map((r) => r.text).sort()).toEqual(["End", "Start"]);

		// The connector references the node shapes' ids (so it follows the nodes).
		const nodeIds = new Set(rects.map((r) => r.id));
		expect(nodeIds.has(connectors[0].sourceId as string)).toBe(true);
		expect(nodeIds.has(connectors[0].targetId as string)).toBe(true);

		// Everything is positioned (dagre layout), all shapes carry an id.
		expect(specs.every((s) => typeof s.id === "string")).toBe(true);
		expect(specs.every((s) => typeof s.x === "number" && typeof s.y === "number")).toBe(true);
	});

	it("converts a decision node into a diamond", () => {
		const specs = converter.convert(codeNode("graph TD\nA[Start] --> B{OK?}"), ctx);
		const diamond = specs.find((s) => s.type === "diamond");
		expect(diamond).toBeDefined();
		expect(diamond?.text).toBe("OK?");
		expect(specs.filter((s) => s.type === "rectangle")).toHaveLength(1);
	});

	it("falls back to a markdown shape for non-flowchart mermaid", () => {
		const specs = converter.convert(
			{
				type: "code",
				lang: "mermaid",
				value: "sequenceDiagram\nA->>B: hi",
				position: { start: { offset: 0 }, end: { offset: 30 } },
			},
			{ ...ctx, source: "```mermaid\nsequenceDiagram\nA->>B: hi\n```" },
		);
		expect(specs).toHaveLength(1);
		expect(specs[0].type).toBe("markdown");
	});
});
