import type { BackgroundComponent, BackgroundComponentProps } from "@usketch/react-canvas";
import React from "react";

/**
 * カスタム背景: パーティクル効果
 */
export const ParticleBackground: BackgroundComponent = ({ camera }) => {
	const particles = React.useMemo(() => {
		return Array.from({ length: 50 }, (_, i) => ({
			id: i,
			x: Math.random() * 2000 - 1000,
			y: Math.random() * 2000 - 1000,
			size: Math.random() * 3 + 1,
			opacity: Math.random() * 0.5 + 0.2,
			speed: Math.random() * 20 + 10,
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
						to={particle.y - camera.y - 200}
						dur={`${particle.speed}s`}
						repeatCount="indefinite"
					/>
					<animate
						attributeName="opacity"
						values={`${particle.opacity};0;${particle.opacity}`}
						dur={`${particle.speed}s`}
						repeatCount="indefinite"
					/>
				</circle>
			))}
		</svg>
	);
};

/**
 * カスタム背景: 波紋効果
 */
export const RippleBackground: React.FC<BackgroundComponentProps> = ({ camera }) => {
	const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);
	const ripplesRef = React.useRef<Array<{ id: number; x: number; y: number; startTime: number }>>(
		[],
	);

	React.useEffect(() => {
		let animationId: number;

		// 初期波紋を追加
		ripplesRef.current = [
			{
				id: Date.now(),
				x: window.innerWidth / 2,
				y: window.innerHeight / 2,
				startTime: Date.now(),
			},
		];

		// 新しい波紋を定期的に追加
		const addRipple = setInterval(() => {
			const now = Date.now();
			// 4秒以上経過した波紋を削除
			ripplesRef.current = ripplesRef.current.filter((r) => now - r.startTime < 4000);

			// 新しい波紋を追加
			ripplesRef.current.push({
				id: now,
				x: Math.random() * window.innerWidth,
				y: Math.random() * window.innerHeight,
				startTime: now,
			});
		}, 1500);

		// アニメーションフレームで更新
		const animate = () => {
			forceUpdate();
			animationId = requestAnimationFrame(animate);
		};
		animate();

		return () => {
			clearInterval(addRipple);
			cancelAnimationFrame(animationId);
		};
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
				overflow: "visible",
			}}
		>
			<title>Ripple background effect</title>
			{ripplesRef.current.map((ripple) => {
				const age = (Date.now() - ripple.startTime) / 4000; // 0 to 1
				if (age > 1) return null;

				const radius = 1 + age * 200;
				const opacity = Math.max(0, 0.4 * (1 - age));

				return (
					<circle
						key={ripple.id}
						cx={ripple.x + camera.x * 0.05}
						cy={ripple.y + camera.y * 0.05}
						r={radius}
						fill="none"
						stroke="#4a90e2"
						strokeWidth="1.5"
						opacity={opacity}
					/>
				);
			})}
		</svg>
	);
};

/**
 * カスタム背景: グラデーションメッシュ
 */
export const GradientMeshBackground: BackgroundComponent = ({ camera }) => {
	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: "0",
					left: "0",
					right: "0",
					bottom: "0",
					background: `linear-gradient(135deg, 
						rgba(102, 126, 234, 0.1) 0%, 
						rgba(118, 75, 162, 0.15) 25%,
						rgba(240, 147, 251, 0.1) 50%,
						rgba(245, 87, 108, 0.15) 75%,
						rgba(102, 126, 234, 0.1) 100%)`,
					transform: `translate(${-camera.x * 0.1}px, ${-camera.y * 0.1}px)`,
				}}
			/>
			<div
				style={{
					position: "absolute",
					top: "0",
					left: "0",
					right: "0",
					bottom: "0",
					background: `radial-gradient(circle at ${50 - camera.x * 0.05}% ${50 - camera.y * 0.05}%, 
						rgba(255, 255, 255, 0) 0%,
						rgba(102, 126, 234, 0.05) 40%,
						rgba(118, 75, 162, 0.1) 100%)`,
				}}
			/>
		</div>
	);
};

/**
 * カスタム背景: 星空
 */
export const StarsBackground: BackgroundComponent = ({ camera }) => {
	const stars = React.useMemo(() => {
		return Array.from({ length: 100 }, (_, i) => ({
			id: i,
			x: Math.random() * 3000 - 1500,
			y: Math.random() * 3000 - 1500,
			size: Math.random() * 2 + 0.5,
			opacity: Math.random() * 0.8 + 0.2,
			twinkle: Math.random() * 3 + 2,
		}));
	}, []);

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg, #0a0e27 0%, #1a1f3a 100%)",
				pointerEvents: "none",
			}}
		>
			<svg
				aria-label="Stars background"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<title>Stars background</title>
				{stars.map((star) => (
					<circle
						key={star.id}
						cx={star.x - camera.x * 0.2}
						cy={star.y - camera.y * 0.2}
						r={star.size * camera.zoom}
						fill="#ffffff"
						opacity={star.opacity}
					>
						<animate
							attributeName="opacity"
							values={`${star.opacity};${star.opacity * 0.3};${star.opacity}`}
							dur={`${star.twinkle}s`}
							repeatCount="indefinite"
						/>
					</circle>
				))}
			</svg>
		</div>
	);
};

/**
 * カスタム背景: ネオンライン
 */
export const NeonLinesBackground: BackgroundComponent = ({ camera }) => {
	const time = React.useRef(0);
	const [_, forceUpdate] = React.useReducer((x) => x + 1, 0);

	React.useEffect(() => {
		const interval = setInterval(() => {
			time.current += 0.01;
			forceUpdate();
		}, 50);
		return () => clearInterval(interval);
	}, []);

	const lines = React.useMemo(() => {
		return Array.from({ length: 5 }, (_, i) => ({
			id: i,
			color: ["#00ffff", "#ff00ff", "#ffff00", "#00ff00", "#ff0080"][i],
			offset: i * 100,
		}));
	}, []);

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				background: "#0a0a0a",
				pointerEvents: "none",
			}}
		>
			<svg
				aria-label="Neon lines background"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<title>Neon lines background</title>
				<defs>
					{lines.map((line) => (
						<filter key={`glow-${line.id}`} id={`glow-${line.id}`}>
							<feGaussianBlur stdDeviation="3" result="coloredBlur" />
							<feMerge>
								<feMergeNode in="coloredBlur" />
								<feMergeNode in="SourceGraphic" />
							</feMerge>
						</filter>
					))}
				</defs>
				{lines.map((line) => (
					<path
						key={line.id}
						d={`M ${-100 - camera.x},${
							300 + line.offset + Math.sin(time.current + line.id) * 50 - camera.y
						} Q ${400 - camera.x},${
							200 + line.offset + Math.cos(time.current + line.id) * 100 - camera.y
						} ${900 - camera.x},${
							300 + line.offset + Math.sin(time.current + line.id + 1) * 50 - camera.y
						}`}
						stroke={line.color}
						strokeWidth="2"
						fill="none"
						filter={`url(#glow-${line.id})`}
						opacity="0.8"
					/>
				))}
			</svg>
		</div>
	);
};
