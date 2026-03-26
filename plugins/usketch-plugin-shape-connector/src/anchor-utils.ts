import type { Point, ShapeData } from "@edv4h/usketch-shared";

export type AnchorType = "auto" | "top" | "right" | "bottom" | "left";

/** Compute the anchor point on a shape's edge */
export function getAnchorPoint(shape: ShapeData, anchor: AnchorType, otherCenter?: Point): Point {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;

	switch (anchor) {
		case "top":
			return { x: cx, y: shape.y };
		case "right":
			return { x: shape.x + shape.width, y: cy };
		case "bottom":
			return { x: cx, y: shape.y + shape.height };
		case "left":
			return { x: shape.x, y: cy };
		case "auto": {
			if (!otherCenter) return { x: cx, y: cy };
			return computeAutoAnchor(shape, otherCenter);
		}
	}
}

/** Compute the intersection of a line from shape center to a target point with the shape's bounding box */
function computeAutoAnchor(shape: ShapeData, target: Point): Point {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const hw = shape.width / 2;
	const hh = shape.height / 2;

	if (hw === 0 && hh === 0) return { x: cx, y: cy };

	const dx = target.x - cx;
	const dy = target.y - cy;

	if (dx === 0 && dy === 0) return { x: cx, y: shape.y }; // Default to top

	// Find intersection with bounding box edges
	const candidates: Point[] = [];

	if (dx !== 0) {
		// Right edge
		const tRight = hw / Math.abs(dx);
		candidates.push({ x: cx + hw * Math.sign(dx), y: cy + dy * tRight });
		// Left edge
		const tLeft = hw / Math.abs(dx);
		candidates.push({ x: cx - hw * Math.sign(dx), y: cy - dy * tLeft });
	}
	if (dy !== 0) {
		// Bottom edge
		const tBottom = hh / Math.abs(dy);
		candidates.push({ x: cx + dx * tBottom, y: cy + hh * Math.sign(dy) });
		// Top edge
		const tTop = hh / Math.abs(dy);
		candidates.push({ x: cx - dx * tTop, y: cy - hh * Math.sign(dy) });
	}

	// Pick the point closest to the target that's on the shape's edge
	let best = { x: cx, y: shape.y };
	let bestDist = Number.POSITIVE_INFINITY;
	for (const p of candidates) {
		// Check if point is on the bounding box edge (within tolerance)
		const onEdge =
			p.x >= shape.x - 0.5 &&
			p.x <= shape.x + shape.width + 0.5 &&
			p.y >= shape.y - 0.5 &&
			p.y <= shape.y + shape.height + 0.5;
		if (!onEdge) continue;

		const dist = Math.hypot(p.x - target.x, p.y - target.y);
		if (dist < bestDist) {
			bestDist = dist;
			best = p;
		}
	}

	return best;
}

/** Find the closest anchor type for a point on a shape's edge */
export function findClosestAnchor(shape: ShapeData, point: Point): AnchorType {
	const anchors: AnchorType[] = ["top", "right", "bottom", "left"];
	let closest: AnchorType = "auto";
	let minDist = Number.POSITIVE_INFINITY;

	for (const anchor of anchors) {
		const p = getAnchorPoint(shape, anchor);
		const dist = Math.hypot(p.x - point.x, p.y - point.y);
		if (dist < minDist) {
			minDist = dist;
			closest = anchor;
		}
	}

	return closest;
}
