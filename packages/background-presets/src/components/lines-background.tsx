import type React from "react";
import { useId } from "react";
import type { BackgroundComponentProps } from "../types";

export interface LinesBackgroundConfig {
	direction?: "horizontal" | "vertical";
	spacing?: number;
	color?: string;
	thickness?: number;
}

export const LinesBackground: React.FC<
	BackgroundComponentProps & { config?: LinesBackgroundConfig }
> = ({ camera, config }) => {
	const patternId = useId();
	const direction = config?.direction || "horizontal";
	const spacing = (config?.spacing || 40) * camera.zoom;
	const color = config?.color || "#e0e0e0";
	const thickness = config?.thickness || 1;
	const isHorizontal = direction === "horizontal";

	return (
		<svg
			aria-label="Lines background"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Lines background</title>
			<defs>
				<pattern
					id={patternId}
					x={isHorizontal ? 0 : camera.x % spacing}
					y={isHorizontal ? camera.y % spacing : 0}
					width={isHorizontal ? "100%" : spacing}
					height={isHorizontal ? spacing : "100%"}
					patternUnits="userSpaceOnUse"
				>
					{isHorizontal ? (
						<line
							x1="0"
							y1={spacing}
							x2="100%"
							y2={spacing}
							stroke={color}
							strokeWidth={thickness}
						/>
					) : (
						<line
							x1={spacing}
							y1="0"
							x2={spacing}
							y2="100%"
							stroke={color}
							strokeWidth={thickness}
						/>
					)}
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill={`url(#${patternId})`} />
		</svg>
	);
};
