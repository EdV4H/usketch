import type React from "react";
import { useBackgroundRenderer } from "../hooks/useBackgroundRenderer";
import type { BackgroundLayerProps } from "../types";

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
	camera,
	options,
	className = "",
}) => {
	const containerRef = useBackgroundRenderer(camera, options);

	return (
		<div
			ref={containerRef}
			className={`background-layer ${className}`.trim()}
			data-testid="background-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
};
