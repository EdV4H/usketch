import type React from "react";
import { useRef } from "react";
import type { BackgroundComponentProps } from "../types";

export const AnimatedGridBackground: React.FC<BackgroundComponentProps> = ({ camera }) => {
	const time = useRef(Date.now());
	const animationOffset = ((Date.now() - time.current) / 50) % 40;

	return (
		<svg
			aria-label="Animated grid background"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Animated grid background</title>
			<defs>
				<pattern
					id="animated-grid"
					x={-camera.x + animationOffset}
					y={-camera.y}
					width={40 * camera.zoom}
					height={40 * camera.zoom}
					patternUnits="userSpaceOnUse"
				>
					<path
						d={`M ${40 * camera.zoom} 0 L 0 0 0 ${40 * camera.zoom}`}
						fill="none"
						stroke="#e0e0e0"
						strokeWidth="1"
					/>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#animated-grid)" />
		</svg>
	);
};
