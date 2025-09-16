import type { FreedrawShape } from "@usketch/shared-types";
import type React from "react";

interface FreedrawProps {
	shape: FreedrawShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const Freedraw: React.FC<FreedrawProps> = ({
	shape,
	isSelected = false,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	// Generate path data from points (like Vanilla version)
	const pathData =
		shape.points && shape.points.length > 0
			? shape.points
					.map((point, index) => {
						// Use relative coordinates (points are relative to shape position)
						const x = point.x - shape.x;
						const y = point.y - shape.y;
						return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
					})
					.join(" ")
			: shape.path || "";

	if (!pathData) return null;

	// Apply translation and rotation transforms
	const transform = shape.rotation
		? `translate(${shape.x}, ${shape.y}) rotate(${shape.rotation} ${shape.width / 2} ${shape.height / 2})`
		: `translate(${shape.x}, ${shape.y})`;

	return (
		<g
			data-shape-id={shape.id}
			data-shape-type="freedraw"
			data-shape="true"
			data-selected={isSelected.toString()}
			className={`shape-freedraw ${isSelected ? "selected" : ""}`}
			transform={transform}
			opacity={shape.opacity ?? 1}
		>
			{/* Invisible rect for better click detection */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG elements need interactions */}
			<rect
				x={0}
				y={0}
				width={shape.width}
				height={shape.height}
				fill="transparent"
				style={{ cursor: "pointer" }}
				onClick={onClick}
				onPointerDown={onPointerDown}
			/>
			<path
				d={pathData}
				fill="none"
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 2}
				strokeLinecap="round"
				strokeLinejoin="round"
				pointerEvents="none"
				style={{ cursor: "pointer" }}
			/>
			{isSelected && (
				<rect
					x={-1}
					y={-1}
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
