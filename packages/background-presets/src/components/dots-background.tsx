import type React from "react";
import type { BackgroundComponentProps } from "../types";

export interface DotsBackgroundConfig {
	spacing?: number;
	size?: number;
	color?: string;
}

export const DotsBackground: React.FC<
	BackgroundComponentProps & { config?: DotsBackgroundConfig }
> = ({ camera, config }) => {
	const spacing = (config?.spacing || 20) * camera.zoom;
	const size = (config?.size || 2) * camera.zoom;
	const color = config?.color || "#d0d0d0";

	return (
		<svg
			aria-label="Dots background"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Dots background</title>
			<defs>
				<pattern
					id="dots"
					x={camera.x % spacing}
					y={camera.y % spacing}
					width={spacing}
					height={spacing}
					patternUnits="userSpaceOnUse"
				>
					<circle cx={spacing / 2} cy={spacing / 2} r={size} fill={color} />
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#dots)" />
		</svg>
	);
};
