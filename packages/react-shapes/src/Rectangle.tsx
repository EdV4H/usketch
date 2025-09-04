import type { RectangleShape } from "@usketch/shared-types";
import type * as React from "react";

interface RectangleProps {
	shape: RectangleShape;
}

export const Rectangle: React.FC<RectangleProps> = ({ shape }) => {
	return (
		<div
			className="shape-rectangle"
			data-shape-id={shape.id}
			data-shape-type="rectangle"
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				backgroundColor: shape.fillColor || "transparent",
				border: shape.strokeWidth
					? `${shape.strokeWidth}px solid ${shape.strokeColor || "#000"}`
					: "none",
				opacity: shape.opacity ?? 1,
				transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
				transformOrigin: "center",
				pointerEvents: "auto",
			}}
		/>
	);
};
