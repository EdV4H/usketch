import type { Shape } from "@usketch/shared-types";
import type React from "react";

interface RectangleShapeProps {
	shape: Shape & { width: number; height: number };
}

export const RectangleShape: React.FC<RectangleShapeProps> = ({ shape }) => {
	return (
		<div
			data-shape-id={shape.id}
			data-shape-type="rectangle"
			data-shape="true"
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				backgroundColor: shape.fillColor,
				border: `${shape.strokeWidth}px solid ${shape.strokeColor}`,
				boxSizing: "border-box",
				transform: `rotate(${shape.rotation}deg)`,
				transformOrigin: "center",
				opacity: shape.opacity,
				pointerEvents: "auto",
			}}
		/>
	);
};
