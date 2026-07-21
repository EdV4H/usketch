import { getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import { generateId, type ShapeData } from "@edv4h/usketch-shared";
import { DEFAULT_APPEARANCE, type ResolvedAppearance } from "./appearance.js";
import { type FrameBox, layoutDiagram } from "./layout.js";
import type { VoiceSummary } from "./summarizer.js";

const boxShape = (b: { x: number; y: number; w: number; h: number }): ShapeData =>
	({ x: b.x, y: b.y, width: b.w, height: b.h, id: "", type: "rectangle", style: {} }) as ShapeData;

// Shapes carry plugin-specific fields (text/sourceId/meta/…) beyond the base
// ShapeData surface; route literals through Record to skip excess-property checks.
const asShape = (o: Record<string, unknown>): ShapeData => o as unknown as ShapeData;

/**
 * Build the child shapes that visualize a summary inside a frame: labeled
 * rounded-rect nodes for each point + id-anchored connectors for links, all
 * parented to `frameId`. Falls back to a single markdown note carrying the raw
 * transcript when there's no usable summary. Shared by the auto-created notes
 * frame and the interactive voice-frame shape.
 */
export function buildSummaryChildren(
	parentId: string | null,
	frameBox: FrameBox,
	summary: VoiceSummary | null,
	transcript: string,
	look: ResolvedAppearance = DEFAULT_APPEARANCE,
): ShapeData[] {
	// Only set parentId when nesting in a frame; the pin places free-floating shapes.
	const parent = parentId ? { parentId } : {};
	const nodeStyle = {
		fill: look.node.fill,
		stroke: look.node.stroke,
		strokeWidth: look.node.strokeWidth,
		opacity: 1,
	};
	const edgeStyle = {
		fill: "transparent",
		stroke: look.connector.stroke,
		strokeWidth: look.connector.strokeWidth,
		opacity: 1,
	};
	if (summary && summary.points.length > 0) {
		const shapes: ShapeData[] = [];
		const { boxes, edges } = layoutDiagram(summary.points, summary.links, frameBox);
		const ids = boxes.map(() => generateId());
		boxes.forEach((b, i) => {
			shapes.push(
				asShape({
					id: ids[i],
					type: "rounded-rect",
					...parent,
					x: b.x,
					y: b.y,
					width: b.w,
					height: b.h,
					style: nodeStyle,
					text: b.detail ? `${b.label}\n${b.detail}` : b.label,
					fontSize: look.node.fontSize,
					isEditing: false,
				}),
			);
		});
		for (const e of edges) {
			const a = boxes[e.from];
			const b = boxes[e.to];
			const aC = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
			const bC = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
			const sp = getAnchorPoint(boxShape(a), "auto", bC);
			const tp = getAnchorPoint(boxShape(b), "auto", aC);
			shapes.push(
				asShape({
					id: generateId(),
					type: "connector",
					...parent,
					x: Math.min(sp.x, tp.x),
					y: Math.min(sp.y, tp.y),
					width: Math.abs(tp.x - sp.x),
					height: Math.abs(tp.y - sp.y),
					style: edgeStyle,
					sourceId: ids[e.from],
					targetId: ids[e.to],
					sourceAnchor: "auto",
					targetAnchor: "auto",
					sourcePoint: sp,
					targetPoint: tp,
					arrowHead: "forward",
					pathType: "straight",
				}),
			);
		}
		return shapes;
	}

	// Fallback: no diagram — drop the transcript as a markdown note.
	return [
		asShape({
			id: generateId(),
			type: "markdown",
			...parent,
			x: frameBox.x + 20,
			y: frameBox.y + 48,
			width: frameBox.width - 40,
			height: frameBox.height - 68,
			style: { fill: "transparent", strokeWidth: 0, stroke: "#1e1e1e", opacity: 1 },
			meta: { source: `### 音声メモ\n\n${transcript}`, isEditing: false },
		}),
	];
}

/** Markdown source summarizing a transcript (title + bullet points), or the raw transcript. */
export function summaryMarkdownSource(summary: VoiceSummary | null, transcript: string): string {
	if (summary && summary.points.length > 0) {
		const lines = [`# ${summary.title}`, ""];
		for (const p of summary.points)
			lines.push(`- **${p.label}**${p.detail ? `: ${p.detail}` : ""}`);
		return lines.join("\n");
	}
	return `### 音声メモ\n\n${transcript}`;
}

/** A standalone markdown shape at a location (for the pin's transcript summary). */
export function markdownShape(
	box: { x: number; y: number; w: number; h: number },
	source: string,
	look: ResolvedAppearance = DEFAULT_APPEARANCE,
): ShapeData {
	return asShape({
		id: generateId(),
		type: "markdown",
		x: box.x,
		y: box.y,
		width: box.w,
		height: box.h,
		style: { fill: look.markdown.fill, stroke: look.markdown.stroke, strokeWidth: 1, opacity: 1 },
		meta: { source, isEditing: false },
	});
}
