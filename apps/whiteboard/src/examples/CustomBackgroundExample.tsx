import { GradientRenderer } from "@usketch/backgrounds";
import {
	AnimatedGridBackground,
	type BackgroundComponent,
	type BackgroundComponentProps,
	GradientBackground,
	PulseBackground,
	WhiteboardCanvas,
} from "@usketch/react-canvas";
import React from "react";

/**
 * カスタムReact背景コンポーネントの例
 * パーティクル効果の背景
 */
const ParticleBackground: BackgroundComponent = ({ camera }) => {
	const particles = React.useMemo(() => {
		return Array.from({ length: 50 }, (_, i) => ({
			id: i,
			x: Math.random() * 1000,
			y: Math.random() * 1000,
			size: Math.random() * 3 + 1,
			opacity: Math.random() * 0.5 + 0.2,
		}));
	}, []);

	return (
		<svg
			aria-label="Particle background effect"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Particle background effect</title>
			{particles.map((particle) => (
				<circle
					key={particle.id}
					cx={particle.x - camera.x}
					cy={particle.y - camera.y}
					r={particle.size * camera.zoom}
					fill="#007acc"
					opacity={particle.opacity}
				>
					<animate
						attributeName="cy"
						from={particle.y - camera.y}
						to={particle.y - camera.y - 100}
						dur="10s"
						repeatCount="indefinite"
					/>
					<animate
						attributeName="opacity"
						values={`${particle.opacity};0;${particle.opacity}`}
						dur="10s"
						repeatCount="indefinite"
					/>
				</circle>
			))}
		</svg>
	);
};

/**
 * 波紋効果の背景コンポーネント
 */
const RippleBackground: React.FC<BackgroundComponentProps> = ({ camera }) => {
	const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);

	React.useEffect(() => {
		const interval = setInterval(() => {
			setRipples((prev) => [
				...prev.slice(-4),
				{
					id: Date.now(),
					x: Math.random() * 800,
					y: Math.random() * 600,
				},
			]);
		}, 2000);

		return () => clearInterval(interval);
	}, []);

	return (
		<svg
			aria-label="Ripple background effect"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<title>Ripple background effect</title>
			{ripples.map((ripple) => (
				<circle
					key={ripple.id}
					cx={ripple.x - camera.x}
					cy={ripple.y - camera.y}
					r="1"
					fill="none"
					stroke="#4a90e2"
					strokeWidth="2"
					opacity="0.6"
				>
					<animate attributeName="r" from="1" to="100" dur="3s" repeatCount="1" />
					<animate attributeName="opacity" from="0.6" to="0" dur="3s" repeatCount="1" />
				</circle>
			))}
		</svg>
	);
};

/**
 * 使用例のコンポーネント
 */
export const CustomBackgroundExamples: React.FC = () => {
	const [backgroundType, setBackgroundType] = React.useState<string>("gradient");

	const getBackgroundConfig = () => {
		switch (backgroundType) {
			case "gradient":
				// プリセットのグラデーション（Reactコンポーネント）
				return {
					type: "component" as const,
					component: GradientBackground,
					config: {
						startColor: "#667eea",
						endColor: "#764ba2",
						angle: 135,
					},
				};

			case "pulse":
				// パルス効果（Reactコンポーネント）
				return {
					type: "component" as const,
					component: PulseBackground,
					config: {
						color: "#00bcd4",
						speed: 1500,
					},
				};

			case "animated-grid":
				// アニメーショングリッド（Reactコンポーネント）
				return {
					type: "component" as const,
					component: AnimatedGridBackground,
				};

			case "particles":
				// カスタムパーティクル効果（Reactコンポーネント）
				return {
					type: "component" as const,
					component: ParticleBackground,
				};

			case "ripple":
				// 波紋効果（Reactコンポーネント）
				return {
					type: "component" as const,
					component: RippleBackground,
				};

			case "gradient-renderer":
				// DOM操作ベースのレンダラー
				return {
					type: "custom" as const,
					renderer: new GradientRenderer(),
					config: {
						startColor: "#ff6b6b",
						endColor: "#4ecdc4",
						angle: 45,
					},
				};

			case "dots":
				// プリセットのドット背景
				return {
					type: "dots" as const,
					spacing: 25,
					size: 3,
					color: "#cbd5e0",
				};

			default:
				return {
					type: "none" as const,
				};
		}
	};

	return (
		<div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
			<div style={{ padding: "1rem", borderBottom: "1px solid #e0e0e0" }}>
				<label htmlFor="background-select" style={{ marginRight: "1rem" }}>
					背景タイプを選択:
				</label>
				<select
					id="background-select"
					value={backgroundType}
					onChange={(e) => setBackgroundType(e.target.value)}
					style={{ padding: "0.5rem" }}
				>
					<option value="gradient">グラデーション (React Component)</option>
					<option value="pulse">パルス効果 (React Component)</option>
					<option value="animated-grid">アニメーショングリッド (React Component)</option>
					<option value="particles">パーティクル (Custom React Component)</option>
					<option value="ripple">波紋 (Custom React Component)</option>
					<option value="gradient-renderer">グラデーション (DOM Renderer)</option>
					<option value="dots">ドット (Preset)</option>
					<option value="none">なし</option>
				</select>
			</div>

			<div style={{ flex: 1, position: "relative" }}>
				<WhiteboardCanvas background={getBackgroundConfig()} />
			</div>
		</div>
	);
};

/**
 * 独自のインタラクティブ背景の例
 * マウスの位置に応じて変化する背景
 */
export const InteractiveBackground: BackgroundComponent = () => {
	const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });

	React.useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			setMousePos({ x: e.clientX, y: e.clientY });
		};

		window.addEventListener("mousemove", handleMouseMove);
		return () => window.removeEventListener("mousemove", handleMouseMove);
	}, []);

	const gradientX = (mousePos.x / window.innerWidth) * 100;
	const gradientY = (mousePos.y / window.innerHeight) * 100;

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: `radial-gradient(circle at ${gradientX}% ${gradientY}%, rgba(100, 150, 255, 0.3) 0%, transparent 50%)`,
				pointerEvents: "none",
			}}
		/>
	);
};
