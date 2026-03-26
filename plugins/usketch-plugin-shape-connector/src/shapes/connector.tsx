import type { BoundingBox, Point, ShapeData } from "@edv4h/usketch-shared";

export type ArrowHead = "none" | "forward" | "backward" | "both";
export type PathType = "straight" | "elbow";

const ARROW_SIZE = 10;

function renderArrowHead(tip: Point, from: Point, color: string): React.ReactElement {
	const dx = tip.x - from.x;
	const dy = tip.y - from.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return <g />;

	const ux = dx / len;
	const uy = dy / len;
	const px = -uy;
	const py = ux;

	const p1x = tip.x - ux * ARROW_SIZE + px * ARROW_SIZE * 0.4;
	const p1y = tip.y - uy * ARROW_SIZE + py * ARROW_SIZE * 0.4;
	const p2x = tip.x - ux * ARROW_SIZE - px * ARROW_SIZE * 0.4;
	const p2y = tip.y - uy * ARROW_SIZE - py * ARROW_SIZE * 0.4;

	return <polygon points={`${tip.x},${tip.y} ${p1x},${p1y} ${p2x},${p2y}`} fill={color} />;
}

export function renderConnector(data: ShapeData) {
	const x1 = (data.sourcePoint as { x: number; y: number } | undefined)?.x ?? data.x;
	const y1 = (data.sourcePoint as { x: number; y: number } | undefined)?.y ?? data.y;
	const x2 = (data.targetPoint as { x: number; y: number } | undefined)?.x ?? data.x + data.width;
	const y2 = (data.targetPoint as { x: number; y: number } | undefined)?.y ?? data.y + data.height;

	const color = data.style.stroke;
	const strokeWidth = data.style.strokeWidth;
	const opacity = data.style.opacity;
	const arrowHead = (data.arrowHead as ArrowHead) ?? "forward";
	const pathType = (data.pathType as PathType) ?? "straight";

	const elements: React.ReactElement[] = [];

	if (pathType === "elbow") {
		const midX = (x1 + x2) / 2;
		const points = `${x1},${y1} ${midX},${y1} ${midX},${y2} ${x2},${y2}`;
		elements.push(
			<polyline
				key="line"
				points={points}
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				opacity={opacity}
			/>,
		);
		if (arrowHead === "forward" || arrowHead === "both") {
			elements.push(
				<g key="arrow-fwd">{renderArrowHead({ x: x2, y: y2 }, { x: midX, y: y2 }, color)}</g>,
			);
		}
		if (arrowHead === "backward" || arrowHead === "both") {
			elements.push(
				<g key="arrow-bwd">{renderArrowHead({ x: x1, y: y1 }, { x: midX, y: y1 }, color)}</g>,
			);
		}
	} else {
		elements.push(
			<line
				key="line"
				x1={x1}
				y1={y1}
				x2={x2}
				y2={y2}
				stroke={color}
				strokeWidth={strokeWidth}
				opacity={opacity}
			/>,
		);
		if (arrowHead === "forward" || arrowHead === "both") {
			elements.push(
				<g key="arrow-fwd">{renderArrowHead({ x: x2, y: y2 }, { x: x1, y: y1 }, color)}</g>,
			);
		}
		if (arrowHead === "backward" || arrowHead === "both") {
			elements.push(
				<g key="arrow-bwd">{renderArrowHead({ x: x1, y: y1 }, { x: x2, y: y2 }, color)}</g>,
			);
		}
	}

	return <g>{elements}</g>;
}

export function getBoundsConnector(data: ShapeData): BoundingBox {
	const x1 = (data.sourcePoint as { x: number; y: number } | undefined)?.x ?? data.x;
	const y1 = (data.sourcePoint as { x: number; y: number } | undefined)?.y ?? data.y;
	const x2 = (data.targetPoint as { x: number; y: number } | undefined)?.x ?? data.x + data.width;
	const y2 = (data.targetPoint as { x: number; y: number } | undefined)?.y ?? data.y + data.height;

	const minX = Math.min(x1, x2);
	const minY = Math.min(y1, y2);
	return {
		x: minX,
		y: minY,
		width: Math.abs(x2 - x1),
		height: Math.abs(y2 - y1),
	};
}

export function hitTestConnector(data: ShapeData, point: Point, tolerance = 6): boolean {
	const x1 = (data.sourcePoint as { x: number; y: number } | undefined)?.x ?? data.x;
	const y1 = (data.sourcePoint as { x: number; y: number } | undefined)?.y ?? data.y;
	const x2 = (data.targetPoint as { x: number; y: number } | undefined)?.x ?? data.x + data.width;
	const y2 = (data.targetPoint as { x: number; y: number } | undefined)?.y ?? data.y + data.height;

	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSq = dx * dx + dy * dy;

	if (lengthSq === 0) {
		return Math.hypot(point.x - x1, point.y - y1) <= tolerance;
	}

	let t = ((point.x - x1) * dx + (point.y - y1) * dy) / lengthSq;
	t = Math.max(0, Math.min(1, t));

	const nearestX = x1 + t * dx;
	const nearestY = y1 + t * dy;
	return Math.hypot(point.x - nearestX, point.y - nearestY) <= tolerance;
}

export function createDefaultConnector(params: { id: string; x: number; y: number }): ShapeData {
	return {
		id: params.id,
		type: "connector",
		x: params.x,
		y: params.y,
		width: 100,
		height: 0,
		style: { fill: "transparent", stroke: "#1e1e1e", strokeWidth: 2, opacity: 1 },
		sourceId: undefined,
		targetId: undefined,
		sourceAnchor: "auto",
		targetAnchor: "auto",
		arrowHead: "forward" as ArrowHead,
		pathType: "straight" as PathType,
		sourcePoint: { x: params.x, y: params.y },
		targetPoint: { x: params.x + 100, y: params.y },
	};
}
