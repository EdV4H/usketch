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

	it("keeps label and shape in sync once a node is explicit", () => {
		// Re-declaring with a different wrapper must not half-update (first wins for
		// both label and shape) — label stayed "Start" so shape must stay "rect".
		const chart = parseFlowchart("graph TD\nA[Start] --> B\nA{Decision} --> C");
		expect(chart?.nodes.get("A")).toEqual({ label: "Start", shape: "rect" });
		// An id-only reference before the explicit declaration is replaced wholesale.
		const chart2 = parseFlowchart("graph TD\nX --> Y\nX{Q?} --> Z");
		expect(chart2?.nodes.get("X")).toEqual({ label: "Q?", shape: "diamond" });
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

	it("clamps connector endpoints to node edges (not centers) on creation", () => {
		const specs = converter.convert(codeNode("graph TD\nA[Start] --> B[End]"), ctx);
		const byId = new Map(specs.map((s) => [s.id as string, s]));
		const conn = specs.find((s) => s.type === "connector");
		expect(conn).toBeDefined();
		const source = byId.get(conn?.sourceId as string);
		const target = byId.get(conn?.targetId as string);
		const sp = conn?.sourcePoint as { x: number; y: number };
		const tp = conn?.targetPoint as { x: number; y: number };
		const onEdge = (p: { x: number; y: number }, s: (typeof specs)[number]) => {
			const nearX = Math.abs(p.x - s.x!) < 0.5 || Math.abs(p.x - (s.x! + s.width!)) < 0.5;
			const nearY = Math.abs(p.y - s.y!) < 0.5 || Math.abs(p.y - (s.y! + s.height!)) < 0.5;
			return nearX || nearY;
		};
		// Endpoints lie on the node bounding boxes' edges, not their centers.
		expect(onEdge(sp, source!)).toBe(true);
		expect(onEdge(tp, target!)).toBe(true);
		const srcCenterY = source!.y! + source!.height! / 2;
		expect(Math.abs(sp.y - srcCenterY) > 0.5).toBe(true); // TD: leaves A's bottom edge, not center
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
