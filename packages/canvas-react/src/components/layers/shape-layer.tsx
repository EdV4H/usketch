import type { Camera, Shape } from "@usketch/shared-types";
import type React from "react";
import { ShapeComponent } from "../shapes/shape-component";

interface ShapeLayerProps {
	shapes: Shape[];
	camera: Camera;
}

export const ShapeLayer: React.FC<ShapeLayerProps> = ({ shapes, camera }) => {
	const transform = `translate(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px) scale(${camera.zoom})`;

	return (
		<div
			className="shape-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				transformOrigin: "0 0",
				transform,
				pointerEvents: "auto",
			}}
		>
			{shapes.map((shape) => (
				<ShapeComponent key={shape.id} shape={shape} />
			))}
		</div>
	);
};
