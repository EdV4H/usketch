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
						// Use absolute coordinates from points
						const x = point.x;
						const y = point.y;
						return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
					})
					.join(" ")
			: shape.path || "";

	if (!pathData) return null;

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
			style={{ cursor: "pointer" }}
			role="button"
			aria-label="Freedraw shape"
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		>
			<path
				d={pathData}
				fill="none"
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 2}
				strokeLinecap="round"
				strokeLinejoin="round"
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
