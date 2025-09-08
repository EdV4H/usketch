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

export interface StarShape extends CustomBaseShape {
	type: "star";
	width: number;
	height: number;
	points: number;
	innerRadius: number;
	outerRadius: number;
}

const StarComponent: React.FC<{
	shape: StarShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const createStarPath = (
		cx: number,
		cy: number,
		points: number,
		outerRadius: number,
		innerRadius: number,
	): string => {
		const angle = Math.PI / points;
		const pathData: string[] = [];

		for (let i = 0; i < 2 * points; i++) {
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const x = cx + Math.cos(i * angle - Math.PI / 2) * radius;
			const y = cy + Math.sin(i * angle - Math.PI / 2) * radius;
			pathData.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
		}
		pathData.push("Z");
		return pathData.join(" ");
	};

	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const outerRadius = shape.outerRadius || Math.min(shape.width, shape.height) / 2;
	const innerRadius = shape.innerRadius || outerRadius * 0.4;
	const points = shape.points || 5;

	return (
		// biome-ignore lint/a11y/useSemanticElements: SVG g element needs role for interactivity
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
				d={createStarPath(cx, cy, points, outerRadius, innerRadius)}
				fill={shape.fillColor || "#FFD700"}
				stroke={shape.strokeColor || "#FFB700"}
				strokeWidth={shape.strokeWidth || 2}
				opacity={shape.opacity || 1}
				style={{ pointerEvents: "all" }}
			/>
			{isSelected && (
				<path
					d={createStarPath(cx, cy, points, outerRadius, innerRadius)}
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

export const starPlugin: ShapePlugin<any> = {
	type: "star",
	component: StarComponent,
	createDefaultShape: (props: {
		id: string;
		x: number;
		y: number;
		width?: number;
		height?: number;
	}) => ({
		id: props.id,
		type: "star" as const,
		x: props.x,
		y: props.y,
		width: props.width || 100,
		height: props.height || 100,
		points: 5,
		innerRadius: Math.min(props.width || 100, props.height || 100) * 0.2,
		outerRadius: Math.min(props.width || 100, props.height || 100) * 0.5,
		rotation: 0,
		opacity: 1,
		fillColor: "#FFD700",
		strokeColor: "#FFB700",
		strokeWidth: 2,
	}),
	getBounds: (shape: StarShape) => ({
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
	}),
	hitTest: (shape: StarShape, point: { x: number; y: number }) => {
		const cx = shape.x + shape.width / 2;
		const cy = shape.y + shape.height / 2;
		const dx = point.x - cx;
		const dy = point.y - cy;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const outerRadius = shape.outerRadius || Math.min(shape.width, shape.height) / 2;
		return distance <= outerRadius;
	},
};
