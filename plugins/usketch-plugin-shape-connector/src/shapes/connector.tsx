import {
	getBoundsConnector,
	getDefaultControlPoint,
	getPathMidpoint,
	hitTestConnector,
	type PathType,
	sourceXY,
	targetXY,
} from "@edv4h/usketch-connector-anchor";
import type { Point, ShapeData } from "@edv4h/usketch-shared";
import { safeRotation } from "@edv4h/usketch-shared";
import type { ConnectorShapeData } from "../types.js";

export type { ArrowHead } from "../types.js";
export type { PathType };
export { getBoundsConnector, hitTestConnector };

const ARROW_SIZE = 10;
const LABEL_FONT_SIZE = 12;
const LABEL_PADDING_X = 6;
const LABEL_PADDING_Y = 3;

// 矢じりの大きさは線の太さに追従させる。既定 strokeWidth=2 で従来の
// ARROW_SIZE(=10) を維持し、太い線ほど頭も大きくなる。
export function arrowSizeFor(strokeWidth: number): number {
	const w = Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : 2;
	return Math.max(ARROW_SIZE, w * 5);
}

// ── Arrow head rendering ──

function renderArrowHead(
	tip: Point,
	from: Point,
	color: string,
	size: number = ARROW_SIZE,
): React.ReactElement {
	const dx = tip.x - from.x;
	const dy = tip.y - from.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return <g />;

	const ux = dx / len;
	const uy = dy / len;
	const px = -uy;
	const py = ux;

	const p1x = tip.x - ux * size + px * size * 0.4;
	const p1y = tip.y - uy * size + py * size * 0.4;
	const p2x = tip.x - ux * size - px * size * 0.4;
	const p2y = tip.y - uy * size - py * size * 0.4;

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
	const connectorData = data as ConnectorShapeData;
	const src = sourceXY(data);
	const tgt = targetXY(data);
	const { x: x1, y: y1 } = src;
	const { x: x2, y: y2 } = tgt;

	const color = data.style.stroke;
	const strokeWidth = data.style.strokeWidth;
	const opacity = data.style.opacity;
	const arrowHead = connectorData.arrowHead ?? "forward";
	const pathType = connectorData.pathType ?? "straight";
	const arrowSize = arrowSizeFor(strokeWidth);

	const elements: React.ReactElement[] = [];

	if (pathType === "curve") {
		const cp = connectorData.controlPoint ?? getDefaultControlPoint(src, tgt);
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
			elements.push(
				<g key="arrow-fwd">{renderArrowHead({ x: x2, y: y2 }, cp, color, arrowSize)}</g>,
			);
		}
		if (arrowHead === "backward" || arrowHead === "both") {
			// Tangent at t=0: direction from cp to p0
			elements.push(
				<g key="arrow-bwd">{renderArrowHead({ x: x1, y: y1 }, cp, color, arrowSize)}</g>,
			);
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
				<g key="arrow-fwd">
					{renderArrowHead({ x: x2, y: y2 }, { x: midX, y: y2 }, color, arrowSize)}
				</g>,
			);
		}
		if (arrowHead === "backward" || arrowHead === "both") {
			elements.push(
				<g key="arrow-bwd">
					{renderArrowHead({ x: x1, y: y1 }, { x: midX, y: y1 }, color, arrowSize)}
				</g>,
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
				<g key="arrow-fwd">
					{renderArrowHead({ x: x2, y: y2 }, { x: x1, y: y1 }, color, arrowSize)}
				</g>,
			);
		}
		if (arrowHead === "backward" || arrowHead === "both") {
			elements.push(
				<g key="arrow-bwd">
					{renderArrowHead({ x: x1, y: y1 }, { x: x2, y: y2 }, color, arrowSize)}
				</g>,
			);
		}
	}

	// Label
	const label = connectorData.label;
	if (label) {
		const cp = connectorData.controlPoint;
		const midpoint = getPathMidpoint(pathType, src, tgt, cp);
		elements.push(renderLabel(label, midpoint, color));
	}

	return <g>{elements}</g>;
}

// ── Default shape ──

export function createDefaultConnector(params: {
	id: string;
	x: number;
	y: number;
}): ConnectorShapeData {
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
		arrowHead: "forward",
		pathType: "straight",
		sourcePoint: { x: params.x, y: params.y },
		targetPoint: { x: params.x + 100, y: params.y },
		controlPoint: undefined,
		controlPointAuto: true,
		label: undefined,
	};
}

// ── Simplified (LOD) component ──

export function SimplifiedConnector({ shape }: { shape: ShapeData }) {
	const connectorData = shape as ConnectorShapeData;
	const src = sourceXY(shape);
	const tgt = targetXY(shape);
	const bounds = getBoundsConnector(shape);
	const rotation = safeRotation(shape.rotation);
	const color = shape.style.stroke ?? "#1e1e1e";
	const arrowHead = connectorData.arrowHead ?? "forward";

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
