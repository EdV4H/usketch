import type { EllipseShape } from "@usketch/shared-types";
import type * as React from "react";

interface EllipseProps {
	shape: EllipseShape;
}

export const Ellipse: React.FC<EllipseProps> = ({ shape }) => {
	return (
		<div
			className="shape-ellipse"
			data-shape-id={shape.id}
			data-shape-type="ellipse"
			style={{
				position: "absolute",
				left: shape.x,
				top: shape.y,
				width: shape.width,
				height: shape.height,
				borderRadius: "50%",
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
