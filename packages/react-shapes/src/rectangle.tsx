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
}) => {
	const transform = shape.rotation
		? `rotate(${shape.rotation} ${shape.x + shape.width / 2} ${shape.y + shape.height / 2})`
		: undefined;

	// Create filter style for shadow effect
	const filterStyle = shape.shadow
		? {
				filter: `drop-shadow(${shape.shadow.offsetX}px ${shape.shadow.offsetY}px ${shape.shadow.blur}px ${shape.shadow.color})`,
				cursor: "pointer" as const,
			}
		: { cursor: "pointer" as const };

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
				style={filterStyle}
				onClick={onClick}
				onPointerDown={onPointerDown}
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
