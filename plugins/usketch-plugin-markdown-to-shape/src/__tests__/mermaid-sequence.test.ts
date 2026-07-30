import type { MarkdownConverterContext, MarkdownNode, ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	createMermaidSequenceConverter,
	isSequenceDiagram,
	parseSequence,
} from "../mermaid-sequence.js";

describe("parseSequence", () => {
	it("returns null for non-sequence diagrams", () => {
		expect(parseSequence("flowchart TD\nA-->B")).toBeNull();
		expect(parseSequence("")).toBeNull();
	});

	it("parses explicit participants (with `as` aliases) and messages", () => {
		const seq = parseSequence(
			"sequenceDiagram\nparticipant U as User\nparticipant W as weboard\nU->>W: click\nW-->>U: reply",
		);
		expect(seq?.participants).toEqual([
			{ id: "U", label: "User" },
			{ id: "W", label: "weboard" },
		]);
		expect(seq?.messages).toEqual([
			{ from: "U", to: "W", text: "click", dashed: false },
			{ from: "W", to: "U", text: "reply", dashed: true }, // `-->>` = dashed
		]);
	});

	it("registers implicit participants in first-appearance order", () => {
		const seq = parseSequence("sequenceDiagram\nAlice->>Bob: hi\nBob->>Charlie: hey");
		expect(seq?.participants.map((p) => p.id)).toEqual(["Alice", "Bob", "Charlie"]);
		expect(seq?.participants.every((p) => p.label === p.id)).toBe(true);
	});

	it("supports the arrow variants and skips block/decoration lines", () => {
		const seq = parseSequence(
			[
				"sequenceDiagram",
				"autonumber",
				"A->B: solid-open",
				"A-)B: async",
				"A-xB: cross",
				"loop every minute",
				"A->>B: inside-loop",
				"end",
				"note over A: ignored",
			].join("\n"),
		);
		expect(seq?.messages.map((m) => m.text)).toEqual([
			"solid-open",
			"async",
			"cross",
			"inside-loop",
		]);
	});
});

describe("isSequenceDiagram", () => {
	it("detects the header (ignoring comments/blank lines)", () => {
		expect(isSequenceDiagram("%% c\n\nsequenceDiagram\nA->>B: x")).toBe(true);
		expect(isSequenceDiagram("flowchart TD\nA-->B")).toBe(false);
	});
});

describe("createMermaidSequenceConverter", () => {
	const converter = createMermaidSequenceConverter();
	const ctx: MarkdownConverterContext = {
		source: "",
		shapes: {} as ShapeRegistry,
		origin: { x: 100, y: 50 },
	};
	const codeNode = (value: string, lang = "mermaid"): MarkdownNode =>
		({ type: "code", lang, value }) as unknown as MarkdownNode;

	it("only matches mermaid sequence diagrams", () => {
		expect(converter.match?.(codeNode("sequenceDiagram\nA->>B: x"))).toBe(true);
		expect(converter.match?.(codeNode("flowchart TD\nA-->B"))).toBe(false);
		expect(converter.match?.(codeNode("sequenceDiagram\nA->>B: x", "js"))).toBe(false);
	});

	it("emits a box + lifeline per participant and a connector per message", () => {
		const specs = converter.convert(codeNode("sequenceDiagram\nA->>B: hello\nB-->>A: hi"), ctx);
		const rects = specs.filter((s) => s.type === "rectangle");
		const connectors = specs.filter((s) => s.type === "connector");
		expect(rects).toHaveLength(2); // A, B
		expect(rects.map((r) => r.text).sort()).toEqual(["A", "B"]);
		// 2 lifelines + 2 messages.
		expect(connectors).toHaveLength(4);
		const messages = connectors.filter((c) => typeof c.label === "string");
		expect(messages.map((m) => m.label)).toEqual(["hello", "hi"]);
		// Messages are horizontal (same source/target Y) with a forward arrow.
		for (const m of messages) {
			const sp = m.sourcePoint as { y: number };
			const tp = m.targetPoint as { y: number };
			expect(sp.y).toBe(tp.y);
			expect(m.arrowHead).toBe("forward");
		}
		// Lifelines are vertical, no arrowhead.
		const lifelines = connectors.filter((c) => c.arrowHead === "none");
		expect(lifelines).toHaveLength(2);
		expect(specs.every((s) => typeof s.id === "string")).toBe(true);
	});

	it("falls back to a markdown shape for an empty diagram", () => {
		const specs = converter.convert(codeNode("sequenceDiagram\nnote over X: hi"), ctx);
		// `note` is skipped and X is never introduced by a message → no participants.
		expect(specs).toHaveLength(1);
		expect(specs[0].type).toBe("markdown");
	});
});
