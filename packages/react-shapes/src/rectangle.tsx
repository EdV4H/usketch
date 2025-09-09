import type { RectangleShape } from "@usketch/shared-types";
import type React from "react";

interface RectangleProps {
	shape: RectangleShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const Rectangle: React.FC<RectangleProps> = ({
	shape,
	isSelected = false,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	const transform = shape.rotation
		? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
		: undefined;

	return (
		<g
			data-shape-id={shape.id}
			data-shape-type="rectangle"
			data-shape="true"
			data-selected={isSelected.toString()}
			className={`shape-rectangle ${isSelected ? "selected" : ""}`}
			transform={transform}
			opacity={shape.opacity ?? 1}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG elements need interactions */}
			<rect
				x={shape.x}
				y={shape.y}
				width={shape.width}
				height={shape.height}
				fill={shape.fillColor || "transparent"}
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 1}
				style={{ cursor: "pointer" }}
				// @ts-ignore - SVG elements need role for accessibility
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
