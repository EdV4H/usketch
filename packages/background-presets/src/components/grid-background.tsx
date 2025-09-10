import type React from "react";
import type { BackgroundComponentProps } from "../types";

export interface GridBackgroundConfig {
	size?: number;
	color?: string;
	thickness?: number;
}

export const GridBackground: React.FC<
	BackgroundComponentProps & { config?: GridBackgroundConfig }
> = ({ camera, config }) => {
	const size = (config?.size || 40) * camera.zoom;
	const color = config?.color || "#e0e0e0";
	const thickness = config?.thickness || 1;

	return (
		<svg
			aria-label="Grid background"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Grid background</title>
			<defs>
				<pattern
					id="grid"
					x={camera.x % size}
					y={camera.y % size}
					width={size}
					height={size}
					patternUnits="userSpaceOnUse"
				>
					<path
						d={`M ${size} 0 L 0 0 0 ${size}`}
						fill="none"
						stroke={color}
						strokeWidth={thickness}
					/>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#grid)" />
		</svg>
	);
};
