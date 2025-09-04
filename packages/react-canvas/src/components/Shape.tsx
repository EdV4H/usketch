import type {
	EllipseShape,
	FreedrawShape,
	RectangleShape,
	Shape as ShapeType,
} from "@usketch/shared-types";
import React from "react";

interface ShapeProps {
	shape: ShapeType;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

// Inline shape components until module resolution is fixed
const Rectangle: React.FC<{
	shape: RectangleShape;
	isSelected: boolean;
	onClick?: any;
	onPointerDown?: any;
	onPointerMove?: any;
	onPointerUp?: any;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const transform = shape.rotation
		? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
		: undefined;

	return (
		<g
			data-shape-id={shape.id}
			data-shape-type="rectangle"
			className={`shape-rectangle ${isSelected ? "selected" : ""}`}
			transform={transform}
			opacity={shape.opacity ?? 1}
		>
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={shape.height}
				fill={shape.fillColor || "transparent"}
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 1}
				style={{ cursor: "pointer" }}
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
			{isSelected && (
				<rect
					x={shape.x - 1}
					y={shape.y - 1}
					width={shape.width + 2}
					height={shape.height + 2}
					fill="none"
					stroke="#007AFF"
					strokeWidth={2}
					strokeDasharray="5,5"
					pointerEvents="none"
				/>
			)}
		</g>
	);
};

const Ellipse: React.FC<{
	shape: EllipseShape;
	isSelected: boolean;
	onClick?: any;
	onPointerDown?: any;
	onPointerMove?: any;
	onPointerUp?: any;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const rx = shape.width / 2;
	const ry = shape.height / 2;

	const transform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

	return (
		<g
			data-shape-id={shape.id}
			data-shape-type="ellipse"
			className={`shape-ellipse ${isSelected ? "selected" : ""}`}
			transform={transform}
			opacity={shape.opacity ?? 1}
		>
			<ellipse
				cx={cx}
				cy={cy}
				rx={rx}
				ry={ry}
				fill={shape.fillColor || "transparent"}
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 1}
				style={{ cursor: "pointer" }}
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
			{isSelected && (
				<ellipse
					cx={cx}
					cy={cy}
					rx={rx + 1}
					ry={ry + 1}
					fill="none"
					stroke="#007AFF"
					strokeWidth={2}
					strokeDasharray="5,5"
					pointerEvents="none"
				/>
			)}
		</g>
	);
};

const Freedraw: React.FC<{
	shape: FreedrawShape;
	isSelected: boolean;
	onClick?: any;
	onPointerDown?: any;
	onPointerMove?: any;
	onPointerUp?: any;
}> = ({ shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
	if (!shape.path) return null;

	const transform = shape.rotation
		? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
		: undefined;

	return (
		<g
			data-shape-id={shape.id}
			data-shape-type="freedraw"
			className={`shape-freedraw ${isSelected ? "selected" : ""}`}
			transform={transform}
			opacity={shape.opacity ?? 1}
		>
			<path
				d={shape.path}
				fill="none"
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 2}
				strokeLinecap="round"
				strokeLinejoin="round"
				style={{ cursor: "pointer" }}
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
			{isSelected && (
				<rect
					x={shape.x - 1}
					y={shape.y - 1}
					width={shape.width + 2}
					height={shape.height + 2}
					fill="none"
					stroke="#007AFF"
					strokeWidth={2}
					strokeDasharray="5,5"
					pointerEvents="none"
				/>
			)}
		</g>
	);
};

export const Shape: React.FC<ShapeProps> = React.memo(
	({ shape, isSelected = false, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
		switch (shape.type) {
			case "rectangle":
				return (
					<Rectangle
						shape={shape}
						isSelected={isSelected}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			case "ellipse":
				return (
					<Ellipse
						shape={shape}
						isSelected={isSelected}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			case "freedraw":
				return (
					<Freedraw
						shape={shape}
						isSelected={isSelected}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			default:
				return null;
		}
	},
);
