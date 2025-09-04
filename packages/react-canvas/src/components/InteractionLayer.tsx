import type * as React from "react";
import type { InteractionLayerProps } from "../types";

export const InteractionLayer: React.FC<InteractionLayerProps> = ({
	camera,
	activeTool,
	className = "",
}) => {
	// This layer will handle preview shapes and interaction feedback
	// For now, it's a placeholder
	return (
		<div
			className={`interaction-layer ${className}`.trim()}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
			data-active-tool={activeTool}
		/>
	);
};
