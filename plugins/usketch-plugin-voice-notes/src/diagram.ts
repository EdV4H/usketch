import { getAnchorPoint } from "@edv4h/usketch-connector-anchor";
import { generateId, type ShapeData } from "@edv4h/usketch-shared";
import { type FrameBox, layoutDiagram } from "./layout.js";
import type { VoiceSummary } from "./summarizer.js";

const boxShape = (b: { x: number; y: number; w: number; h: number }): ShapeData =>
	({ x: b.x, y: b.y, width: b.w, height: b.h, id: "", type: "rectangle", style: {} }) as ShapeData;

/**
 * Build the child shapes that visualize a summary inside a frame: labeled
 * rounded-rect nodes for each point + id-anchored connectors for links, all
 * parented to `frameId`. Falls back to a single markdown note carrying the raw
 * transcript when there's no usable summary. Shared by the auto-created notes
 * frame and the interactive voice-frame shape.
 */
export function buildSummaryChildren(
	frameId: string,
	frameBox: FrameBox,
	summary: VoiceSummary | null,
	transcript: string,
): ShapeData[] {
	if (summary && summary.points.length > 0) {
		const shapes: ShapeData[] = [];
		const { boxes, edges } = layoutDiagram(summary.points, summary.links, frameBox);
		const ids = boxes.map(() => generateId());
		boxes.forEach((b, i) => {
			shapes.push({
				id: ids[i],
				type: "rounded-rect",
				parentId: frameId,
				x: b.x,
				y: b.y,
				width: b.w,
				height: b.h,
				style: { fill: "#ffffff", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
				text: b.detail ? `${b.label}\n${b.detail}` : b.label,
				fontSize: 13,
				isEditing: false,
			} as ShapeData);
		});
		for (const e of edges) {
			const a = boxes[e.from];
			const b = boxes[e.to];
			const aC = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
			const bC = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
			const sp = getAnchorPoint(boxShape(a), "auto", bC);
			const tp = getAnchorPoint(boxShape(b), "auto", aC);
			shapes.push({
				id: generateId(),
				type: "connector",
				parentId: frameId,
				x: Math.min(sp.x, tp.x),
				y: Math.min(sp.y, tp.y),
				width: Math.abs(tp.x - sp.x),
				height: Math.abs(tp.y - sp.y),
				style: { fill: "transparent", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
				sourceId: ids[e.from],
				targetId: ids[e.to],
				sourceAnchor: "auto",
				targetAnchor: "auto",
				sourcePoint: sp,
				targetPoint: tp,
				arrowHead: "forward",
				pathType: "straight",
			} as ShapeData);
		}
		return shapes;
	}

	// Fallback: no diagram — drop the transcript as a markdown note inside the frame.
	return [
		{
			id: generateId(),
			type: "markdown",
			parentId: frameId,
			x: frameBox.x + 20,
			y: frameBox.y + 48,
			width: frameBox.width - 40,
			height: frameBox.height - 68,
			style: { fill: "transparent", strokeWidth: 0, stroke: "#1e1e1e", opacity: 1 },
			meta: { source: `### 音声メモ\n\n${transcript}`, isEditing: false },
		} as ShapeData,
	];
}
