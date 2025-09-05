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
 * グリッド背景のReactコンポーネント
 */
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

	const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(`
		<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
			<rect width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${thickness}" />
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
				backgroundSize: `${size}px ${size}px`,
				backgroundPosition: `${-camera.x % size}px ${-camera.y % size}px`,
				pointerEvents: "none",
			}}
		/>
	);
};

/**
 * ライン背景のReactコンポーネント
 */
export interface LinesBackgroundConfig {
	direction?: "horizontal" | "vertical" | "both";
	spacing?: number;
	color?: string;
	thickness?: number;
}

export const LinesBackground: React.FC<
	BackgroundComponentProps & { config?: LinesBackgroundConfig }
> = ({ camera, config }) => {
	const direction = config?.direction || "horizontal";
	const spacing = (config?.spacing || 40) * camera.zoom;
	const color = config?.color || "#e0e0e0";
	const thickness = config?.thickness || 1;

	const createSvgDataUrl = () => {
		if (direction === "both") {
			// GridBackgroundと同じ
			return `data:image/svg+xml,${encodeURIComponent(`
				<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
					<rect width="${spacing}" height="${spacing}" fill="none" stroke="${color}" stroke-width="${thickness}" />
				</svg>
			`)}`;
		} else if (direction === "horizontal") {
			return `data:image/svg+xml,${encodeURIComponent(`
				<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
					<line x1="0" y1="${spacing}" x2="${spacing}" y2="${spacing}" stroke="${color}" stroke-width="${thickness}" />
				</svg>
			`)}`;
		} else {
			return `data:image/svg+xml,${encodeURIComponent(`
				<svg width="${spacing}" height="${spacing}" viewBox="0 0 ${spacing} ${spacing}" xmlns="http://www.w3.org/2000/svg">
					<line x1="${spacing}" y1="0" x2="${spacing}" y2="${spacing}" stroke="${color}" stroke-width="${thickness}" />
				</svg>
			`)}`;
		}
	};

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundImage: `url("${createSvgDataUrl()}")`,
				backgroundSize: `${spacing}px ${spacing}px`,
				backgroundPosition: `${-camera.x % spacing}px ${-camera.y % spacing}px`,
				pointerEvents: "none",
			}}
		/>
	);
};

/**
 * アイソメトリック背景のReactコンポーネント
 */
export interface IsometricBackgroundConfig {
	size?: number;
	color?: string;
}

export const IsometricBackground: React.FC<
	BackgroundComponentProps & { config?: IsometricBackgroundConfig }
> = ({ camera, config }) => {
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
					id="isometric"
					x={-camera.x}
					y={-camera.y}
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
			<rect width="100%" height="100%" fill="url(#isometric)" />
		</svg>
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
