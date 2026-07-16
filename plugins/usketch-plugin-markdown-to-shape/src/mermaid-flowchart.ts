import dagre from "@dagrejs/dagre";
import {
	generateId,
	type MarkdownConverter,
	type MarkdownNode,
	type MarkdownShapeSpec,
} from "@edv4h/usketch-shared";
import { nodeSource } from "./mdast.js";

// ── Flowchart parsing ──

export interface FlowchartEdge {
	source: string;
	target: string;
	label?: string;
}
export interface Flowchart {
	direction: "TB" | "BT" | "LR" | "RL";
	nodes: Map<string, string>; // id → label
	edges: FlowchartEdge[];
}

const HEADER = /^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/i;
// Arrow operators mermaid supports (a pragmatic subset), with an optional |label|.
const ARROW = /\s*(?:-{2,}>|-{3,}|-\.->|-\.-|={2,}>)\s*(?:\|([^|]*)\|\s*)?/g;
// A node token: id + optional [..]/(..)/{..}/((..))/>..] label wrapper.
const NODE_TOKEN =
	/^([A-Za-z0-9_-]+)(?:\(\(([^)]*)\)\)|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|>([^\]]*)\])?/;

function parseNodeToken(tok: string): { id: string; label: string } | null {
	const m = NODE_TOKEN.exec(tok.trim());
	if (!m) return null;
	const raw = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6];
	const label = raw != null && raw.trim() !== "" ? raw.trim().replace(/^["']|["']$/g, "") : m[1];
	return { id: m[1], label };
}

/**
 * Parse a (subset of) mermaid `flowchart`/`graph` source into nodes + edges.
 * Handles node shapes, inline labels, edge labels and chains (`A --> B --> C`).
 * Returns null when the block isn't a flowchart (→ caller falls back).
 */
export function parseFlowchart(code: string): Flowchart | null {
	const lines = code
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));
	if (lines.length === 0) return null;

	const header = HEADER.exec(lines[0]);
	if (!header) return null;
	const dir = header[1].toUpperCase();
	const direction = dir === "TD" ? "TB" : (dir as Flowchart["direction"]);

	const nodes = new Map<string, string>();
	const edges: FlowchartEdge[] = [];
	const addNode = (n: { id: string; label: string }) => {
		// Keep an explicit label over an id-only placeholder.
		const prev = nodes.get(n.id);
		if (prev === undefined || prev === n.id) nodes.set(n.id, n.label);
	};

	// Statements after the header (also split on `;`).
	const statements = lines
		.slice(1)
		.flatMap((l) => l.split(";"))
		.map((s) => s.trim())
		.filter(Boolean);

	for (const stmt of statements) {
		// Skip directives we don't model (styling / class / subgraph).
		if (/^(subgraph|end|classDef|class|style|linkStyle|click)\b/i.test(stmt)) continue;

		ARROW.lastIndex = 0;
		const tokens: string[] = [];
		const arrowLabels: (string | undefined)[] = [];
		let last = 0;
		let m: RegExpExecArray | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: standard global-regex scan
		while ((m = ARROW.exec(stmt)) !== null) {
			tokens.push(stmt.slice(last, m.index));
			arrowLabels.push(m[1]?.trim() || undefined);
			last = ARROW.lastIndex;
		}
		tokens.push(stmt.slice(last));

		const parsed = tokens.map(parseNodeToken);
		if (arrowLabels.length === 0) {
			// Standalone node declaration.
			if (parsed[0]) addNode(parsed[0]);
			continue;
		}
		for (let i = 0; i < parsed.length; i++) {
			const p = parsed[i];
			if (p) addNode(p);
		}
		for (let i = 0; i < arrowLabels.length; i++) {
			const a = parsed[i];
			const b = parsed[i + 1];
			if (a && b) edges.push({ source: a.id, target: b.id, label: arrowLabels[i] });
		}
	}

	return nodes.size > 0 ? { direction, nodes, edges } : null;
}

// ── Layout + conversion ──

const NODE_HEIGHT = 44;
const nodeWidth = (label: string) => Math.max(80, label.length * 8 + 24);

interface LaidOutNode {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Run dagre to position the flowchart's nodes (centers), offset by origin. */
function layout(chart: Flowchart, origin: { x: number; y: number }): Map<string, LaidOutNode> {
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: chart.direction, nodesep: 40, ranksep: 60, marginx: 8, marginy: 8 });
	g.setDefaultEdgeLabel(() => ({}));
	for (const [id, label] of chart.nodes) {
		g.setNode(id, { width: nodeWidth(label), height: NODE_HEIGHT });
	}
	for (const e of chart.edges) g.setEdge(e.source, e.target);
	dagre.layout(g);

	const out = new Map<string, LaidOutNode>();
	for (const id of chart.nodes.keys()) {
		const n = g.node(id) as { x: number; y: number; width: number; height: number } | undefined;
		if (!n) continue;
		out.set(id, {
			x: origin.x + n.x - n.width / 2,
			y: origin.y + n.y - n.height / 2,
			width: n.width,
			height: n.height,
		});
	}
	return out;
}

/**
 * Converter: a ```mermaid``` flowchart → `rectangle` + `text` nodes joined by
 * `connector`s (id-anchored, so they follow the nodes). Non-flowchart mermaid or
 * a parse failure falls back to a single `markdown` shape (renders the diagram).
 */
export function createMermaidFlowchartConverter(): MarkdownConverter {
	return {
		id: "markdown-to-shape:mermaid-flowchart",
		nodeTypes: ["code"],
		match: (node: MarkdownNode) => node.lang === "mermaid",
		order: 10,
		convert: (node, ctx) => {
			const code = typeof node.value === "string" ? node.value : "";
			const chart = parseFlowchart(code);
			if (!chart) {
				return [
					{
						type: "markdown",
						meta: { source: nodeSource(node, ctx.source), isEditing: false },
						style: { fill: "transparent", strokeWidth: 0 },
					},
				];
			}

			const placed = layout(chart, ctx.origin);
			const rectIdByNode = new Map<string, string>();
			const specs: MarkdownShapeSpec[] = [];

			for (const [id, label] of chart.nodes) {
				const box = placed.get(id);
				if (!box) continue;
				const rectId = generateId();
				rectIdByNode.set(id, rectId);
				specs.push({
					type: "rectangle",
					id: rectId,
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
					style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2 },
					cornerRadius: 4,
				});
				specs.push({
					type: "text",
					id: generateId(),
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
					text: label,
					fontSize: 14,
					fontFamily: "system-ui, sans-serif",
					isEditing: false,
					style: { fill: "transparent", strokeWidth: 0, stroke: "#1e1e1e" },
				});
			}

			for (const edge of chart.edges) {
				const from = placed.get(edge.source);
				const to = placed.get(edge.target);
				const sourceId = rectIdByNode.get(edge.source);
				const targetId = rectIdByNode.get(edge.target);
				if (!from || !to || !sourceId || !targetId) continue;
				const sp = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
				const tp = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
				specs.push({
					type: "connector",
					id: generateId(),
					x: Math.min(sp.x, tp.x),
					y: Math.min(sp.y, tp.y),
					width: Math.abs(tp.x - sp.x),
					height: Math.abs(tp.y - sp.y),
					style: { fill: "transparent", stroke: "#1e1e1e", strokeWidth: 2 },
					sourceId,
					targetId,
					sourceAnchor: "auto",
					targetAnchor: "auto",
					sourcePoint: sp,
					targetPoint: tp,
					arrowHead: "forward",
					pathType: "straight",
					label: edge.label,
				});
			}

			return specs;
		},
	};
}
