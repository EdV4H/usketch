import type * as React from "react";
import type { BackgroundLayerProps } from "../types";

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
	camera,
	options,
	className = "",
}) => {
	// For now, just render a simple background
	// Later this will be replaced with actual background renderers
	return (
		<div
			className={`background-layer ${className}`.trim()}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundColor: options?.color || "#f8f8f8",
				pointerEvents: "none",
			}}
		/>
	);
};
