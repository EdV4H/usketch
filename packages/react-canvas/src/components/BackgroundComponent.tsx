import type { Camera } from "@usketch/shared-types";
import type React from "react";

/**
 * React背景コンポーネントのプロパティ
 */
export interface BackgroundComponentProps {
	camera: Camera;
	config?: any;
}

/**
 * React背景コンポーネントのインターフェース
 */
export type BackgroundComponent = React.FC<BackgroundComponentProps>;

/**
 * グラデーション背景のReactコンポーネント例
 */
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

/**
 * パルスアニメーション背景のReactコンポーネント例
 */
export interface PulseBackgroundConfig {
	color?: string;
	speed?: number;
}

export const PulseBackground: React.FC<
	BackgroundComponentProps & { config?: PulseBackgroundConfig }
> = ({ camera, config }) => {
	const color = config?.color || "#007acc";
	const speed = config?.speed || 2000;

	return (
		<>
			<style>
				{`
					@keyframes pulse-bg-react {
						0% { opacity: 0.3; }
						50% { opacity: 0.1; }
						100% { opacity: 0.3; }
					}
				`}
			</style>
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					backgroundColor: color,
					animation: `pulse-bg-react ${speed}ms infinite`,
					transform: `scale(${camera.zoom})`,
					transformOrigin: "0 0",
					pointerEvents: "none",
				}}
			/>
		</>
	);
};

/**
 * ドット背景のReactコンポーネント例
 */
export interface DotsBackgroundConfig {
	spacing?: number;
	size?: number;
	color?: string;
}

export const DotsBackground: React.FC<
	BackgroundComponentProps & { config?: DotsBackgroundConfig }
> = ({ camera, config }) => {
	const spacing = (config?.spacing || 20) * camera.zoom;
	const size = config?.size || 2;
	const color = config?.color || "#d0d0d0";

	const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(`
		<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
			<circle cx="${spacing / 2}" cy="${spacing / 2}" r="${size / 2}" fill="${color}" />
		</svg>
	`)}`;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundImage: `url("${svgDataUrl}")`,
				backgroundSize: `${spacing}px ${spacing}px`,
				backgroundPosition: `${-camera.x % spacing}px ${-camera.y % spacing}px`,
				pointerEvents: "none",
			}}
		/>
	);
};

/**
 * カスタム背景コンポーネントの例: アニメーショングリッド
 */
export const AnimatedGridBackground: React.FC<BackgroundComponentProps> = ({ camera }) => {
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
					x={-camera.x}
					y={-camera.y}
					width={40 * camera.zoom}
					height={40 * camera.zoom}
					patternUnits="userSpaceOnUse"
				>
					<rect
						width={40 * camera.zoom}
						height={40 * camera.zoom}
						fill="none"
						stroke="#e0e0e0"
						strokeWidth="1"
						opacity="0.5"
					>
						<animate
							attributeName="stroke-opacity"
							values="0.2;0.8;0.2"
							dur="3s"
							repeatCount="indefinite"
						/>
					</rect>
				</pattern>
			</defs>
			<rect width="100%" height="100%" fill="url(#animated-grid)" />
		</svg>
	);
};
