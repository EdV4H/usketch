import dagre from "@dagrejs/dagre";
import { getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import {
	DEFAULT_STYLE,
	generateId,
	type MarkdownConverter,
	type MarkdownNode,
	type MarkdownShapeSpec,
	type ShapeData,
} from "@edv4h/usketch-shared";
import { nodeSource } from "./mdast.js";

// ── Flowchart parsing ──

/** Node geometry parsed from the mermaid wrapper syntax. */
export type NodeShape = "rect" | "round" | "circle" | "diamond";

export interface FlowNode {
	label: string;
	shape: NodeShape;
}
export interface FlowchartEdge {
	source: string;
	target: string;
	label?: string;
}
export interface Flowchart {
	direction: "TB" | "BT" | "LR" | "RL";
	nodes: Map<string, FlowNode>; // id → { label, shape }
	edges: FlowchartEdge[];
}

const HEADER = /^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/i;
// Arrow operators mermaid supports (a pragmatic subset), with an optional |label|.
const ARROW = /\s*(?:-{2,}>|-{3,}|-\.->|-\.-|={2,}>)\s*(?:\|([^|]*)\|\s*)?/g;
// A node token: id + optional [..]/(..)/{..}/((..))/>..] label wrapper.
const NODE_TOKEN =
	/^([A-Za-z0-9_-]+)(?:\(\(([^)]*)\)\)|\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|>([^\]]*)\])?/;

interface ParsedNode {
	id: string;
	label: string;
	shape: NodeShape;
	/** True when the token carried a wrapper (`[..]`/`(..)`/`{..}`/…) — i.e. an
	 * explicit declaration, as opposed to a bare id reference in an edge. */
	explicit: boolean;
}

function parseNodeToken(tok: string): ParsedNode | null {
	const m = NODE_TOKEN.exec(tok.trim());
	if (!m) return null;
	// Wrapper syntax → node shape: ((circle)) [rect] (round) {diamond} >flag].
	let shape: NodeShape = "rect";
	let raw: string | undefined;
	if (m[2] != null) [shape, raw] = ["circle", m[2]];
	else if (m[4] != null) [shape, raw] = ["round", m[4]];
	else if (m[5] != null) [shape, raw] = ["diamond", m[5]];
	else if (m[3] != null) [shape, raw] = ["rect", m[3]];
	else if (m[6] != null) [shape, raw] = ["rect", m[6]]; // asymmetric >..] → approx rectangle
	const explicit = raw != null; // a wrapper was present (even if its label is empty)
	const label = raw != null && raw.trim() !== "" ? raw.trim().replace(/^["']|["']$/g, "") : m[1];
	return { id: m[1], label, shape, explicit };
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

	const nodes = new Map<string, FlowNode>();
	const explicitIds = new Set<string>(); // ids declared with a wrapper
	const edges: FlowchartEdge[] = [];
	const addNode = (n: ParsedNode) => {
		// A bare id reference is a placeholder that an explicit declaration replaces
		// wholesale. Once a node is explicit, keep BOTH its label and shape stable
		// (first explicit wins) so a later re-declaration can't half-update them.
		// Explicitness is tracked from the wrapper, not inferred from the label —
		// otherwise an explicit `A[A]` (label == id) would look like a placeholder.
		if (nodes.has(n.id) && explicitIds.has(n.id)) return;
		nodes.set(n.id, { label: n.label, shape: n.shape });
		if (n.explicit) explicitIds.add(n.id);
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

/** mermaid node shape → geo shape type (all label-able geo shapes). */
const GEO_TYPE: Record<NodeShape, string> = {
	rect: "rectangle",
	round: "rounded-rect",
	circle: "ellipse",
	diamond: "diamond",
};

/**
 * Size multipliers per shape: a diamond/ellipse only fits its centered label in
 * its inscribed rect (~half the area), so grow the bounding box accordingly.
 */
const SHAPE_SIZE: Record<NodeShape, { w: number; h: number }> = {
	rect: { w: 1, h: 1 },
	round: { w: 1, h: 1 },
	circle: { w: 1.3, h: 1.8 },
	diamond: { w: 1.5, h: 1.8 },
};

interface LaidOutNode {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** A valid (axis-aligned, unrotated) ShapeData for a laid-out box, so anchor
 * geometry stays correct even if getAnchorPoint later reads more than bounds. */
const boxShape = (b: LaidOutNode): ShapeData => ({
	id: "",
	type: "rectangle",
	x: b.x,
	y: b.y,
	width: b.width,
	height: b.height,
	style: DEFAULT_STYLE,
});

/** Run dagre to position the flowchart's nodes (centers), offset by origin. */
function layout(chart: Flowchart, origin: { x: number; y: number }): Map<string, LaidOutNode> {
	const g = new dagre.graphlib.Graph();
	g.setGraph({ rankdir: chart.direction, nodesep: 40, ranksep: 60, marginx: 8, marginy: 8 });
	g.setDefaultEdgeLabel(() => ({}));
	for (const [id, node] of chart.nodes) {
		const mult = SHAPE_SIZE[node.shape];
		g.setNode(id, {
			width: Math.round(nodeWidth(node.label) * mult.w),
			height: Math.round(NODE_HEIGHT * mult.h),
		});
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
 * Converter: a ```mermaid``` flowchart → geo nodes joined by `connector`s
 * (id-anchored, so they follow the nodes). Node wrapper syntax maps to geo
 * shapes — `[..]` rectangle, `(..)` rounded-rect, `((..))` ellipse, `{..}`
 * diamond (decision) — each carrying its label as a centered geo label.
 * Non-flowchart mermaid or a parse failure falls back to a single `markdown`
 * shape (renders the diagram).
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
			const shapeIdByNode = new Map<string, string>();
			const specs: MarkdownShapeSpec[] = [];

			for (const [id, node] of chart.nodes) {
				const box = placed.get(id);
				if (!box) continue;
				const shapeId = generateId();
				shapeIdByNode.set(id, shapeId);
				const type = GEO_TYPE[node.shape];
				// The label rides on the geo shape itself (centered GeoLabel), so a
				// decision `{...}` becomes a diamond with its text centered inside.
				specs.push({
					type,
					id: shapeId,
					x: box.x,
					y: box.y,
					width: box.width,
					height: box.height,
					style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2 },
					text: node.label,
					fontSize: 14,
					isEditing: false,
					...(type === "rectangle" ? { cornerRadius: 4 } : {}),
				});
			}

			for (const edge of chart.edges) {
				const from = placed.get(edge.source);
				const to = placed.get(edge.target);
				const sourceId = shapeIdByNode.get(edge.source);
				const targetId = shapeIdByNode.get(edge.target);
				if (!from || !to || !sourceId || !targetId) continue;
				// Clamp endpoints to each node's edge (toward the other node's center),
				// matching the interactive draw tool. Without this the arrow is stored
				// center-to-center and only snaps to the edges once a node is moved.
				const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
				const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
				const sp = getAnchorPoint(boxShape(from), "auto", toCenter);
				const tp = getAnchorPoint(boxShape(to), "auto", fromCenter);
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
