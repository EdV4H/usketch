import type * as React from "react";
import type { ShapeLayerProps } from "../types";
import { Shape } from "./Shape";

export const ShapeLayer: React.FC<ShapeLayerProps> = ({ shapes, camera, className = "" }) => {
	const shapeArray = Object.values(shapes);

	const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

	return (
		<div
			className={`shape-layer ${className}`.trim()}
			data-testid="shape-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				transform,
				transformOrigin: "0 0",
				pointerEvents: "none",
			}}
		>
			{shapeArray.map((shape) => (
				<Shape key={shape.id} shape={shape} />
			))}
		</div>
	);
};
