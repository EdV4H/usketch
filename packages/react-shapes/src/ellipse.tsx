import type { EllipseShape } from "@usketch/shared-types";
import type React from "react";

interface EllipseProps {
	shape: EllipseShape;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

export const Ellipse: React.FC<EllipseProps> = ({
	shape,
	isSelected = false,
	onClick,
	onPointerDown,
}) => {
	const cx = shape.x + shape.width / 2;
	const cy = shape.y + shape.height / 2;
	const rx = shape.width / 2;
	const ry = shape.height / 2;

	const transform = shape.rotation ? `rotate(${shape.rotation} ${cx} ${cy})` : undefined;

	// Create filter style for shadow effect
	const filterStyle = shape.shadow
		? {
				filter: `drop-shadow(${shape.shadow.offsetX}px ${shape.shadow.offsetY}px ${shape.shadow.blur}px ${shape.shadow.color})`,
				pointerEvents: "none" as const,
			}
		: { pointerEvents: "none" as const };

	return (
		<g
			data-shape-id={shape.id}
			data-shape-type="ellipse"
			data-shape="true"
			data-selected={isSelected.toString()}
			className={`shape-ellipse ${isSelected ? "selected" : ""}`}
			transform={transform}
			opacity={shape.opacity ?? 1}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: SVG elements need interactions */}
			<ellipse
				cx={cx}
				cy={cy}
				rx={rx}
				ry={ry}
				fill={shape.fillColor || "transparent"}
				stroke={shape.strokeColor || "#000"}
				strokeWidth={shape.strokeWidth || 1}
				style={filterStyle}
				onClick={onClick}
				onPointerDown={onPointerDown}
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
