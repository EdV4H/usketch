import {
	generateId,
	type MarkdownConverter,
	type MarkdownNode,
	type MarkdownShapeSpec,
} from "@edv4h/usketch-shared";
import { nodeSource } from "./mdast.js";

// ── Sequence-diagram parsing ──────────────────────────────────────────────────

export interface SeqParticipant {
	id: string;
	label: string;
}
export interface SeqMessage {
	from: string;
	to: string;
	text: string;
	/** `-->`/`-->>` (reply) style. Rendered solid for now — the shape model has no
	 *  dash — but kept so callers/tests can distinguish. */
	dashed: boolean;
}
export interface Sequence {
	participants: SeqParticipant[];
	messages: SeqMessage[];
}

/** Lines that introduce blocks/decorations we don't model yet — skipped. */
const SKIP =
	/^(activate|deactivate|note|loop|alt|opt|else|end|par|and|rect|critical|break|autonumber|title|link|links|box|create|destroy)\b/i;
// `A->>B: text` — dash(es) + arrow head + target + `: message`.
const MESSAGE = /^(.+?)\s*(-{1,2})(>>|>|\)|x)\s*(.+?)\s*:\s*(.*)$/;
// `participant Alice` or `participant A as Alice` (also `actor`).
const PARTICIPANT = /^(?:participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i;

function meaningfulLines(code: string): string[] {
	return code
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("%%"));
}

/** Cheap check: is this mermaid block a `sequenceDiagram`? */
export function isSequenceDiagram(code: string): boolean {
	const lines = meaningfulLines(code);
	return lines.length > 0 && /^sequenceDiagram\b/i.test(lines[0]);
}

/**
 * Parse a (subset of) mermaid `sequenceDiagram` source into participants +
 * messages. Participants are ordered by declaration, or by first appearance in a
 * message when not explicitly declared. Block/decoration lines (activate, note,
 * loop, …) are skipped. Returns null when the block isn't a sequenceDiagram.
 */
export function parseSequence(code: string): Sequence | null {
	const lines = meaningfulLines(code);
	if (lines.length === 0 || !/^sequenceDiagram\b/i.test(lines[0])) return null;

	const participants: SeqParticipant[] = [];
	const seen = new Map<string, SeqParticipant>();
	const addParticipant = (id: string, label?: string) => {
		const existing = seen.get(id);
		if (existing) {
			// A later explicit `as` label upgrades a placeholder registered from a message.
			if (label && existing.label === existing.id) existing.label = label;
			return;
		}
		const p = { id, label: label ?? id };
		seen.set(id, p);
		participants.push(p);
	};

	const messages: SeqMessage[] = [];
	for (const line of lines.slice(1)) {
		if (SKIP.test(line)) continue;

		const pm = PARTICIPANT.exec(line);
		if (pm) {
			addParticipant(pm[1], pm[2]?.trim());
			continue;
		}

		const mm = MESSAGE.exec(line);
		if (mm) {
			const from = mm[1].trim();
			const to = mm[4].trim();
			addParticipant(from);
			addParticipant(to);
			messages.push({ from, to, text: mm[5].trim(), dashed: mm[2] === "--" });
		}
	}

	return { participants, messages };
}

// ── Layout + conversion ───────────────────────────────────────────────────────

const BOX_H = 44;
const COL_GAP = 64; // horizontal gap between participant boxes
const MSG_TOP = 34; // gap from the box bottom to the first message
const MSG_GAP = 40; // vertical gap between messages
const SELF_W = 48; // width of a self-message stub
const boxWidth = (label: string) => Math.max(80, label.length * 8 + 24);

const BOX_STYLE = { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2 };
const LIFELINE_STYLE = { fill: "transparent", stroke: "#9aa0a6", strokeWidth: 1.5 };
const MSG_STYLE = { fill: "transparent", stroke: "#1e1e1e", strokeWidth: 2 };

interface Col {
	x: number; // box left
	width: number;
	center: number;
}

/**
 * Converter: a ```mermaid``` `sequenceDiagram` → participant boxes along the top,
 * a lifeline down from each, and one horizontal message connector per message
 * (labelled, arrow toward the target). Non-sequence mermaid is left to the
 * flowchart converter; an empty diagram falls back to a `markdown` shape.
 *
 * Phase 1 (participants + messages). Activations / notes / fragments (loop/alt)
 * are skipped for now.
 */
export function createMermaidSequenceConverter(): MarkdownConverter {
	return {
		id: "markdown-to-shape:mermaid-sequence",
		nodeTypes: ["code"],
		// Higher order than the flowchart converter (10) so sequence diagrams win.
		match: (node: MarkdownNode) =>
			node.lang === "mermaid" && typeof node.value === "string" && isSequenceDiagram(node.value),
		order: 20,
		convert: (node, ctx) => {
			const code = typeof node.value === "string" ? node.value : "";
			const seq = parseSequence(code);
			if (!seq || seq.participants.length === 0) {
				return [
					{
						type: "markdown",
						meta: { source: nodeSource(node, ctx.source), isEditing: false },
						style: { fill: "transparent", strokeWidth: 0 },
					},
				];
			}

			// Place participant columns left→right.
			const cols = new Map<string, Col>();
			let cursorX = ctx.origin.x;
			for (const p of seq.participants) {
				const width = boxWidth(p.label);
				cols.set(p.id, { x: cursorX, width, center: cursorX + width / 2 });
				cursorX += width + COL_GAP;
			}

			const top = ctx.origin.y;
			const lifelineTop = top + BOX_H;
			const firstMsgY = lifelineTop + MSG_TOP;
			const bottomY = firstMsgY + Math.max(1, seq.messages.length) * MSG_GAP;

			const specs: MarkdownShapeSpec[] = [];

			// Participant boxes + lifelines.
			for (const p of seq.participants) {
				const col = cols.get(p.id);
				if (!col) continue;
				specs.push({
					type: "rectangle",
					id: generateId(),
					x: col.x,
					y: top,
					width: col.width,
					height: BOX_H,
					style: BOX_STYLE,
					text: p.label,
					fontSize: 14,
					isEditing: false,
					cornerRadius: 4,
				});
				specs.push({
					type: "connector",
					id: generateId(),
					x: col.center,
					y: lifelineTop,
					width: 0,
					height: bottomY - lifelineTop,
					style: LIFELINE_STYLE,
					sourcePoint: { x: col.center, y: lifelineTop },
					targetPoint: { x: col.center, y: bottomY },
					arrowHead: "none",
					pathType: "straight",
				});
			}

			// Messages: horizontal connectors between lifelines at increasing Y.
			seq.messages.forEach((msg, i) => {
				const a = cols.get(msg.from);
				const b = cols.get(msg.to);
				if (!a || !b) return;
				const y = firstMsgY + i * MSG_GAP;
				// Self-message → a short stub to the right (a full loop is future work).
				const sp = { x: a.center, y };
				const tp = a === b ? { x: a.center + SELF_W, y } : { x: b.center, y };
				specs.push({
					type: "connector",
					id: generateId(),
					x: Math.min(sp.x, tp.x),
					y,
					width: Math.abs(tp.x - sp.x),
					height: 0,
					style: MSG_STYLE,
					sourcePoint: sp,
					targetPoint: tp,
					arrowHead: "forward",
					pathType: "straight",
					label: msg.text || undefined,
				});
			});

			return specs;
		},
	};
}
