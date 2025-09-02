import type { Camera, Shape } from "@usketch/shared-types";
import type React from "react";
import { ShapeComponent } from "../shapes/shape-component";

interface PreviewLayerProps {
	shape: Shape | null;
	camera: Camera;
}

export const PreviewLayer: React.FC<PreviewLayerProps> = ({ shape, camera }) => {
	const transform = `translate(${-camera.x * camera.zoom}px, ${-camera.y * camera.zoom}px) scale(${camera.zoom})`;

	if (!shape) return null;

	return (
		<div
			className="preview-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				transformOrigin: "0 0",
				transform,
				pointerEvents: "none",
				opacity: 0.5,
			}}
		>
			<ShapeComponent shape={shape} />
		</div>
	);
};
