import type React from "react";
import { useId } from "react";
import type { BackgroundComponentProps } from "../types";

export interface IsometricBackgroundConfig {
	size?: number;
	color?: string;
}

export const IsometricBackground: React.FC<
	BackgroundComponentProps & { config?: IsometricBackgroundConfig }
> = ({ camera, config }) => {
	const patternId = useId();
	const size = (config?.size || 40) * camera.zoom;
	const color = config?.color || "#e0e0e0";
	const height = (size * Math.sqrt(3)) / 2;

	return (
		<svg
			aria-label="Isometric background"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Isometric background</title>
			<defs>
				<pattern
					id={patternId}
					x={camera.x % (size * 2)}
					y={camera.y % (height * 2)}
					width={size * 2}
					height={height * 2}
					patternUnits="userSpaceOnUse"
				>
					{/* 左斜めの線 */}
					<line x1={0} y1={height} x2={size} y2={0} stroke={color} strokeWidth="1" />
					<line
						x1={size}
						y1={height * 2}
						x2={size * 2}
						y2={height}
						stroke={color}
						strokeWidth="1"
					/>

					{/* 右斜めの線 */}
					<line x1={size} y1={0} x2={size * 2} y2={height} stroke={color} strokeWidth="1" />
					<line x1={0} y1={height} x2={size} y2={height * 2} stroke={color} strokeWidth="1" />

					{/* 垂直線 */}
					<line x1={size} y1={0} x2={size} y2={height * 2} stroke={color} strokeWidth="1" />
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill={`url(#${patternId})`} />
		</svg>
	);
};
