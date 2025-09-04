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
