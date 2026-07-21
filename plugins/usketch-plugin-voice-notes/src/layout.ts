import type { SummaryPoint } from "./summarizer.js";

export interface LaidOutBox {
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
	detail?: string;
}

export interface DiagramLayout {
	boxes: LaidOutBox[];
	edges: { from: number; to: number }[];
}

export interface FrameBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

const TITLE_BAND = 40; // space reserved for the frame title at the top
const PAD = 24;
const GAP = 20;

/**
 * Place summary points as a grid of boxes inside the frame (below the title
 * band), preserving `links` as edges by index. Pure & deterministic: box count
 * decides the column count (≈√n), boxes share a uniform cell so nothing
 * overlaps and everything stays within the frame bounds.
 */
export function layoutDiagram(
	points: SummaryPoint[],
	links: [number, number][],
	frame: FrameBox,
): DiagramLayout {
	const n = points.length;
	if (n === 0) return { boxes: [], edges: [] };

	const cols = Math.ceil(Math.sqrt(n));
	const rows = Math.ceil(n / cols);

	const availW = Math.max(0, frame.width - PAD * 2);
	const availH = Math.max(0, frame.height - TITLE_BAND - PAD * 2);
	const cellW = (availW - GAP * (cols - 1)) / cols;
	const cellH = (availH - GAP * (rows - 1)) / rows;
	const w = Math.max(60, cellW);
	const h = Math.max(40, Math.min(cellH, 90));

	const originX = frame.x + PAD;
	const originY = frame.y + TITLE_BAND + PAD;

	const boxes: LaidOutBox[] = points.map((p, i) => {
		const col = i % cols;
		const row = Math.floor(i / cols);
		return {
			x: Math.round(originX + col * (w + GAP)),
			y: Math.round(originY + row * (h + GAP)),
			w: Math.round(w),
			h: Math.round(h),
			label: p.label,
			...(p.detail ? { detail: p.detail } : {}),
		};
	});

	// Dedup + validate edges against the box count.
	const seen = new Set<string>();
	const edges: { from: number; to: number }[] = [];
	for (const [from, to] of links) {
		if (from < 0 || to < 0 || from >= n || to >= n || from === to) continue;
		const key = `${from}-${to}`;
		if (seen.has(key)) continue;
		seen.add(key);
		edges.push({ from, to });
	}

	return { boxes, edges };
}
