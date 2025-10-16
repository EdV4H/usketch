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

export interface HeartShape extends CustomBaseShape {
	type: "heart";
	width: number;
	height: number;
}

const HeartComponent: React.FC<{
	shape: HeartShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const createHeartPath = (x: number, y: number, width: number, height: number): string => {
		// Create a classic heart shape
		const w = width;
		const h = height;

		// Start from the bottom point
		const bottomX = x + w / 2;
		const bottomY = y + h * 0.9;

		// Top curves
		const topY = y + h * 0.2;

		// Control points for smooth curves
		const path = `
      M ${bottomX},${bottomY}
      C ${x + w * 0.1},${y + h * 0.65} ${x},${y + h * 0.35} ${x + w * 0.05},${topY}
      C ${x + w * 0.1},${y + h * 0.05} ${x + w * 0.35},${y + h * 0.05} ${x + w * 0.5},${y + h * 0.3}
      C ${x + w * 0.65},${y + h * 0.05} ${x + w * 0.9},${y + h * 0.05} ${x + w * 0.95},${topY}
      C ${x + w},${y + h * 0.35} ${x + w * 0.9},${y + h * 0.65} ${bottomX},${bottomY}
      Z
    `;

		return path.trim();
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
				d={createHeartPath(shape.x, shape.y, shape.width, shape.height)}
				fill={shape.fillColor || "#FF69B4"}
				stroke={shape.strokeColor || "#FF1493"}
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

export const heartPlugin: ShapePlugin<any> = {
	type: "heart",
	component: HeartComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "heart" as const,
		x: props.x,
		y: props.y,
		width: props.width || 100,
		height: props.height || 90,
		rotation: 0,
		opacity: 1,
		fillColor: "#FF69B4",
		strokeColor: "#FF1493",
		strokeWidth: 2,
	}),
	getBounds: (shape: HeartShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: HeartShape, point: { x: number; y: number }) => {
		// Simple bounding box hit test for heart shape
		return (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		);
	},
};
