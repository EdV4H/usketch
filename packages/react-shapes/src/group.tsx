import type { GroupShape } from "@usketch/shared-types";
import type React from "react";

interface GroupProps {
	shape: GroupShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

/**
 * Group component that renders a bounding box for grouped shapes
 * The actual child shapes are rendered separately
 */
export const Group: React.FC<GroupProps> = ({
	shape,
	isSelected = false,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	const { x, y, width, height, opacity = 1, strokeColor, strokeWidth } = shape;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: SVG g element can have event handlers
		<g
			data-shape-id={shape.id}
			data-shape-type="group"
			aria-label={`Group ${shape.name || shape.id}`}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			style={{
				cursor: "move",
				opacity,
			}}
		>
			{/* Group bounding box (only visible when selected or has visible stroke) */}
			{(isSelected || (strokeColor !== "transparent" && strokeWidth > 0)) && (
				<rect
					x={x}
					y={y}
					width={width}
					height={height}
					fill="none"
					stroke={isSelected ? "#2196f3" : strokeColor}
					strokeWidth={isSelected ? 2 : strokeWidth}
					strokeDasharray={isSelected ? "5,5" : "none"}
					pointerEvents="none"
				/>
			)}

			{/* Group label (optional, shown when selected) */}
			{isSelected && shape.name && (
				<text
					x={x + 5}
					y={y - 5}
					fontSize="12"
					fill="#2196f3"
					fontFamily="sans-serif"
					pointerEvents="none"
				>
					{shape.name}
				</text>
			)}
		</g>
	);
};
