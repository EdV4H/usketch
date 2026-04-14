import type { BoundingBox, Point, ShapeData } from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import {
	bezierBounds,
	distanceToLineSegment,
	distanceToPolyline,
	getDefaultControlPoint,
	getElbowPoints,
	getPathMidpoint,
	isNearBezier,
	type PathType,
} from "../path-utils.js";

export type ArrowHead = "none" | "forward" | "backward" | "both";
export type { PathType } from "../path-utils.js";

const ARROW_SIZE = 10;
const LABEL_FONT_SIZE = 12;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 3;

// ── Helpers to extract endpoints ──

function sourceXY(data: ShapeData): Point {
	const p = data.sourcePoint as Point | undefined;
	return { x: p?.x ?? data.x, y: p?.y ?? data.y };
}

function targetXY(data: ShapeData): Point {
	const p = data.targetPoint as Point | undefined;
	return { x: p?.x ?? data.x + data.width, y: p?.y ?? data.y + data.height };
}

// ── Arrow head rendering ──

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

// ── Label rendering ──

function renderLabel(label: string, midpoint: Point, color: string): React.ReactElement {
	const estimatedWidth = label.length * LABEL_FONT_SIZE * 0.6 + LABEL_PADDING_X * 2;
	const height = LABEL_FONT_SIZE + LABEL_PADDING_Y * 2;
	return (
		<g key="label">
			<rect
				x={midpoint.x - estimatedWidth / 2}
				y={midpoint.y - height / 2}
				width={estimatedWidth}
				height={height}
				rx={3}
				fill="white"
				opacity={0.85}
			/>
			<text
				x={midpoint.x}
				y={midpoint.y}
				textAnchor="middle"
				dominantBaseline="central"
				fontSize={LABEL_FONT_SIZE}
				fill={color}
				style={{ pointerEvents: "none", userSelect: "none" }}
			>
				{label}
			</text>
		</g>
	);
}

// ── Main render ──

export function renderConnector(data: ShapeData) {
	const src = sourceXY(data);
	const tgt = targetXY(data);
	const { x: x1, y: y1 } = src;
	const { x: x2, y: y2 } = tgt;

	const color = data.style.stroke;
	const strokeWidth = data.style.strokeWidth;
	const opacity = data.style.opacity;
	const arrowHead = (data.arrowHead as ArrowHead) ?? "forward";
	const pathType = (data.pathType as PathType) ?? "straight";

	const elements: React.ReactElement[] = [];

	if (pathType === "curve") {
		const cp = (data.controlPoint as Point | undefined) ?? getDefaultControlPoint(src, tgt);
		elements.push(
			<path
				key="line"
				d={`M ${x1},${y1} Q ${cp.x},${cp.y} ${x2},${y2}`}
				fill="none"
				stroke={color}
				strokeWidth={strokeWidth}
				opacity={opacity}
			/>,
		);
		// Arrow heads use tangent direction at endpoints
		if (arrowHead === "forward" || arrowHead === "both") {
			// Tangent at t=1: direction from cp to p2
			elements.push(<g key="arrow-fwd">{renderArrowHead({ x: x2, y: y2 }, cp, color)}</g>);
		}
		if (arrowHead === "backward" || arrowHead === "both") {
			// Tangent at t=0: direction from cp to p0
			elements.push(<g key="arrow-bwd">{renderArrowHead({ x: x1, y: y1 }, cp, color)}</g>);
		}
	} else if (pathType === "elbow") {
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
		// straight
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

	// Label
	const label = data.label as string | undefined;
	if (label) {
		const cp = (data.controlPoint as Point | undefined) ?? undefined;
		const midpoint = getPathMidpoint(pathType, src, tgt, cp);
		elements.push(renderLabel(label, midpoint, color));
	}

	return <g>{elements}</g>;
}

// ── Bounds ──

export function getBoundsConnector(data: ShapeData): BoundingBox {
	const src = sourceXY(data);
	const tgt = targetXY(data);
	const pathType = (data.pathType as PathType) ?? "straight";

	if (pathType === "curve") {
		const cp = (data.controlPoint as Point | undefined) ?? getDefaultControlPoint(src, tgt);
		return bezierBounds(src, cp, tgt);
	}

	const minX = Math.min(src.x, tgt.x);
	const minY = Math.min(src.y, tgt.y);
	return {
		x: minX,
		y: minY,
		width: Math.abs(tgt.x - src.x),
		height: Math.abs(tgt.y - src.y),
	};
}

// ── Hit test ──

export function hitTestConnector(data: ShapeData, point: Point, tolerance = 6): boolean {
	const src = sourceXY(data);
	const tgt = targetXY(data);
	const pathType = (data.pathType as PathType) ?? "straight";

	if (pathType === "curve") {
		const cp = (data.controlPoint as Point | undefined) ?? getDefaultControlPoint(src, tgt);
		return isNearBezier(point, src, cp, tgt, tolerance);
	}

	if (pathType === "elbow") {
		const elbowPts = getElbowPoints(src, tgt);
		return distanceToPolyline(point, elbowPts) <= tolerance;
	}

	// straight
	return distanceToLineSegment(point, src, tgt) <= tolerance;
}

// ── Default shape ──

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
		controlPoint: undefined,
		controlPointAuto: true,
		label: undefined,
	};
}

// ── Simplified (LOD) component ──

export function SimplifiedConnector({ shape }: { shape: ShapeData }) {
	const src = sourceXY(shape);
	const tgt = targetXY(shape);
	const bounds = getBoundsConnector(shape);
	const rotation = safeRotation(shape.rotation);
	const color = shape.style.stroke ?? "#1e1e1e";
	const arrowHead = (shape.arrowHead as ArrowHead) ?? "forward";

	// Minimum size to avoid zero-dimension SVGs
	const w = Math.max(bounds.width, 2);
	const h = Math.max(bounds.height, 2);

	return (
		<div
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: w,
				height: h,
				pointerEvents: "none",
				transform: rotation ? `rotate(${rotation}deg)` : undefined,
				transformOrigin: "center center",
			}}
		>
			<svg
				width={w}
				height={h}
				viewBox={`${bounds.x} ${bounds.y} ${w} ${h}`}
				style={{ overflow: "visible" }}
			>
				<line
					x1={src.x}
					y1={src.y}
					x2={tgt.x}
					y2={tgt.y}
					stroke={color}
					strokeWidth={1.5}
					opacity={0.7}
				/>
				{(arrowHead === "forward" || arrowHead === "both") && (
					<polygon
						points={`${tgt.x},${tgt.y} ${tgt.x - 6},${tgt.y - 3} ${tgt.x - 6},${tgt.y + 3}`}
						fill={color}
						opacity={0.7}
					/>
				)}
			</svg>
		</div>
	);
}
