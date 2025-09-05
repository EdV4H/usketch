import type React from "react";
import type { BackgroundComponentProps } from "../types";

export interface GradientBackgroundConfig {
	startColor?: string;
	endColor?: string;
	angle?: number;
}

export const GradientBackground: React.FC<
	BackgroundComponentProps & { config?: GradientBackgroundConfig }
> = ({ camera, config }) => {
	const startColor = config?.startColor || "#ff0000";
	const endColor = config?.endColor || "#0000ff";
	const angle = config?.angle || 45;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: `linear-gradient(${angle}deg, ${startColor}, ${endColor})`,
				backgroundSize: "200% 200%",
				backgroundPosition: camera.zoom !== 1 ? `${-camera.x}px ${-camera.y}px` : undefined,
				pointerEvents: "none",
			}}
		/>
	);
};
