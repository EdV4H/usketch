import type React from "react";
import type { BackgroundComponentProps } from "../types";

export interface PulseBackgroundConfig {
	color?: string;
	speed?: number;
}

export const PulseBackground: React.FC<
	BackgroundComponentProps & { config?: PulseBackgroundConfig }
> = ({ config }) => {
	const color = config?.color || "#007acc";
	const speed = config?.speed || 2000;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
				animation: `pulse ${speed}ms ease-in-out infinite`,
				pointerEvents: "none",
			}}
		>
			<style>
				{`
					@keyframes pulse {
						0%, 100% { transform: scale(1); opacity: 0.5; }
						50% { transform: scale(1.05); opacity: 0.8; }
					}
				`}
			</style>
		</div>
	);
};
