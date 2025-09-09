import type { ShapePlugin } from "@usketch/shape-registry";
import type React from "react";

// Custom base shape interface for custom shapes
interface CustomBaseShape {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	strokeColor: string;
	fillColor: string;
	strokeWidth: number;
}

export interface TriangleShape extends CustomBaseShape {
	type: "triangle";
	width: number;
	height: number;
	direction?: "up" | "down" | "left" | "right";
}

const TriangleComponent: React.FC<{
	shape: TriangleShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const createTrianglePath = (
		x: number,
		y: number,
		width: number,
		height: number,
		direction: string = "up",
	): string => {
		switch (direction) {
			case "up":
				return `M ${x + width / 2},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
			case "down":
				return `M ${x},${y} L ${x + width},${y} L ${x + width / 2},${y + height} Z`;
			case "left":
				return `M ${x},${y + height / 2} L ${x + width},${y} L ${x + width},${y + height} Z`;
			case "right":
				return `M ${x + width},${y + height / 2} L ${x},${y} L ${x},${y + height} Z`;
			default:
				return `M ${x + width / 2},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
		}
	};

	return (
		<g
			role="button"
			tabIndex={0}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			style={{ cursor: "pointer" }}
		>
			<path
				d={createTrianglePath(shape.x, shape.y, shape.width, shape.height, shape.direction)}
				fill={shape.fillColor || "#00CED1"}
				stroke={shape.strokeColor || "#008B8B"}
				strokeWidth={shape.strokeWidth || 2}
				opacity={shape.opacity || 1}
				style={{ pointerEvents: "all" }}
			/>
			{isSelected && (
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					fill="none"
					stroke="#0066FF"
					strokeWidth={2}
					strokeDasharray="5,5"
					opacity={0.5}
					style={{ pointerEvents: "none" }}
				/>
			)}
		</g>
	);
};

export const trianglePlugin: ShapePlugin<any> = {
	type: "triangle",
	component: TriangleComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "triangle" as const,
		x: props.x,
		y: props.y,
		width: props.width || 100,
		height: props.height || 100,
		direction: "up",
		rotation: 0,
		opacity: 1,
		fillColor: "#00CED1",
		strokeColor: "#008B8B",
		strokeWidth: 2,
	}),
	getBounds: (shape: TriangleShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: TriangleShape, point: { x: number; y: number }) => {
		// Point in triangle test using barycentric coordinates
		const { x: sx, y: sy, width, height, direction = "up" } = shape;

		let p1: { x: number; y: number };
		let p2: { x: number; y: number };
		let p3: { x: number; y: number };
		switch (direction) {
			case "up":
				p1 = { x: sx + width / 2, y: sy };
				p2 = { x: sx + width, y: sy + height };
				p3 = { x: sx, y: sy + height };
				break;
			case "down":
				p1 = { x: sx, y: sy };
				p2 = { x: sx + width, y: sy };
				p3 = { x: sx + width / 2, y: sy + height };
				break;
			case "left":
				p1 = { x: sx, y: sy + height / 2 };
				p2 = { x: sx + width, y: sy };
				p3 = { x: sx + width, y: sy + height };
				break;
			case "right":
				p1 = { x: sx + width, y: sy + height / 2 };
				p2 = { x: sx, y: sy };
				p3 = { x: sx, y: sy + height };
				break;
			default:
				p1 = { x: sx + width / 2, y: sy };
				p2 = { x: sx + width, y: sy + height };
				p3 = { x: sx, y: sy + height };
		}

		// Barycentric coordinates calculation
		const sign = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
			return (px - bx) * (ay - by) - (ax - bx) * (py - by);
		};

		const d1 = sign(point.x, point.y, p1.x, p1.y, p2.x, p2.y);
		const d2 = sign(point.x, point.y, p2.x, p2.y, p3.x, p3.y);
		const d3 = sign(point.x, point.y, p3.x, p3.y, p1.x, p1.y);

		const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
		const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

		return !(hasNeg && hasPos);
	},
};
