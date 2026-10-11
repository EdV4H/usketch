import { DEFAULT_STYLE, type Point, type ShapeData } from "@edv4h/usketch-shared";
import type { ArrowDirection, ArrowShapeData } from "../types.js";

export type { ArrowDirection };

/** Head length as a ratio of the thickness (cross-axis size). 120x60 → 48, as before. */
const HEAD_RATIO = 0.8;

function directionOf(data: ShapeData): ArrowDirection {
	return (data as ArrowShapeData).direction ?? "right";
}

function isHorizontal(direction: ArrowDirection): boolean {
	return direction === "right" || direction === "left";
}

/**
 * The head size depends only on the thickness, so resizing along the axis
 * stretches the shaft alone and the edge that isn't dragged stays put.
 */
export function getArrowPoints(data: ShapeData): Point[] {
	const { x, y, width: w, height: h } = data;
	const direction = directionOf(data);
	const horizontal = isHorizontal(direction);
	const length = horizontal ? w : h;
	const thickness = horizontal ? h : w;
	const headBase = length - Math.min(thickness * HEAD_RATIO, length);
	// (u, v): u along the axis from tail to tip, v across it.
	const local: [number, number][] = [
		[0, thickness * 0.3],
		[headBase, thickness * 0.3],
		[headBase, 0],
		[length, thickness / 2],
		[headBase, thickness],
		[headBase, thickness * 0.7],
		[0, thickness * 0.7],
	];
	const toWorld: Record<ArrowDirection, (u: number, v: number) => Point> = {
		right: (u, v) => ({ x: x + u, y: y + v }),
		left: (u, v) => ({ x: x + w - u, y: y + v }),
		down: (u, v) => ({ x: x + v, y: y + u }),
		up: (u, v) => ({ x: x + v, y: y + h - u }),
	};
	return local.map(([u, v]) => toWorld[direction](u, v));
}

/** Direction for a creation drag: the dominant axis and its sign (ties → horizontal). */
export function getArrowDirection(dx: number, dy: number): ArrowDirection {
	if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
	return dy < 0 ? "up" : "down";
}

const OPPOSITE: Record<ArrowDirection, ArrowDirection> = {
	right: "left",
	left: "right",
	up: "down",
	down: "up",
};

/** `ShapeDefinition.flip`: reverse only when the bounds flip along the arrow's axis. */
export function flipArrow(
	data: ShapeData,
	axes: { x: boolean; y: boolean },
): Partial<ArrowShapeData> {
	const direction = directionOf(data);
	const alongAxis = isHorizontal(direction) ? axes.x : axes.y;
	return alongAxis ? { direction: OPPOSITE[direction] } : {};
}

export function renderArrow(data: ShapeData) {
	const pts = getArrowPoints(data);
	const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
	return (
		<polygon
			points={points}
			fill={data.style.fill}
			stroke={data.style.stroke}
			strokeWidth={data.style.strokeWidth}
			opacity={data.style.opacity}
		/>
	);
}

export function createDefaultArrow(params: { id: string; x: number; y: number }): ArrowShapeData {
	return {
		id: params.id,
		type: "arrow",
		x: params.x,
		y: params.y,
		width: 120,
		height: 60,
		direction: "right",
		style: { ...DEFAULT_STYLE },
	};
}
