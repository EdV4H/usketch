import {
	type BackgroundComponent,
	type BackgroundComponentProps,
	BackgroundRegistry,
	globalBackgroundRegistry,
	PRESET_BACKGROUNDS_METADATA,
	WhiteboardCanvas,
} from "@usketch/react-canvas";
import React, { useEffect, useId, useState } from "react";

/**
 * カスタム背景コンポーネントの例：パーティクル効果
 */
const ParticleBackground: BackgroundComponent = ({ camera }: BackgroundComponentProps) => {
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
 * カスタム背景コンポーネント：波紋効果
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
 * BackgroundRegistryの使用例
 */
export const BackgroundRegistryExample: React.FC = () => {
	const selectId = useId();
	const [selectedBgId, setSelectedBgId] = useState<string>("usketch.dots");
	const [availableBackgrounds, setAvailableBackgrounds] = useState<string[]>([]);
	const [customRegistry] = useState(() => new BackgroundRegistry());
	const [bgConfig, setBgConfig] = useState<any>({});

	useEffect(() => {
		// カスタム背景を登録
		globalBackgroundRegistry.register("custom.particles", ParticleBackground);
		globalBackgroundRegistry.register("custom.ripple", RippleBackground);

		// 遅延読み込みの例（実際には動的importを使用）
		globalBackgroundRegistry.registerLazy("custom.heavy", async () => {
			// シミュレーション：重い背景コンポーネントを遅延読み込み
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return { default: ParticleBackground }; // 実際は別コンポーネント
		});

		// カスタムレジストリの例
		customRegistry.register("local.custom", RippleBackground);

		// 利用可能な背景リストを更新
		setAvailableBackgrounds(globalBackgroundRegistry.list());
	}, [customRegistry]);

	// 選択された背景のメタデータを取得
	const selectedMetadata =
		PRESET_BACKGROUNDS_METADATA[selectedBgId as keyof typeof PRESET_BACKGROUNDS_METADATA];

	return (
		<div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
			<div style={{ padding: "1rem", borderBottom: "1px solid #e0e0e0" }}>
				<h2>Background Registry Example</h2>

				<div style={{ marginTop: "1rem" }}>
					<label htmlFor={selectId} style={{ marginRight: "1rem" }}>
						背景を選択:
					</label>
					<select
						id={selectId}
						value={selectedBgId}
						onChange={(e) => {
							setSelectedBgId(e.target.value);
							// デフォルト設定をロード
							const metadata =
								PRESET_BACKGROUNDS_METADATA[
									e.target.value as keyof typeof PRESET_BACKGROUNDS_METADATA
								];
							if (metadata?.defaultConfig) {
								setBgConfig(metadata.defaultConfig);
							} else {
								setBgConfig({});
							}
						}}
						style={{ padding: "0.5rem", marginRight: "1rem" }}
					>
						<optgroup label="uSketch プリセット">
							{availableBackgrounds
								.filter((id) => id.startsWith("usketch."))
								.map((id) => {
									const meta =
										PRESET_BACKGROUNDS_METADATA[id as keyof typeof PRESET_BACKGROUNDS_METADATA];
									return (
										<option key={id} value={id}>
											{meta ? `${meta.name} - ${meta.description}` : id}
										</option>
									);
								})}
						</optgroup>
						<optgroup label="カスタム背景">
							{availableBackgrounds
								.filter((id) => id.startsWith("custom."))
								.map((id) => (
									<option key={id} value={id}>
										{id}
									</option>
								))}
						</optgroup>
					</select>

					<button
						type="button"
						onClick={() => {
							// インライン背景の例
							setSelectedBgId("inline.gradient");
						}}
						style={{ padding: "0.5rem 1rem" }}
					>
						インライン背景を使用
					</button>
				</div>

				{selectedMetadata && (
					<div style={{ marginTop: "1rem" }}>
						<h4>設定:</h4>
						<div style={{ display: "flex", gap: "1rem" }}>
							{Object.entries(selectedMetadata.defaultConfig).map(([key, value]) => (
								<div key={key} style={{ display: "flex", flexDirection: "column" }}>
									<label htmlFor={`config-${key}`}>{key}:</label>
									{typeof value === "number" ? (
										<input
											id={`config-${key}`}
											type="number"
											value={bgConfig[key] ?? value}
											onChange={(e) =>
												setBgConfig((prev: any) => ({
													...prev,
													[key]: Number(e.target.value),
												}))
											}
											style={{ padding: "0.25rem" }}
										/>
									) : (
										<input
											id={`config-${key}`}
											type="text"
											value={bgConfig[key] ?? value}
											onChange={(e) =>
												setBgConfig((prev: any) => ({
													...prev,
													[key]: e.target.value,
												}))
											}
											style={{ padding: "0.25rem" }}
										/>
									)}
								</div>
							))}
						</div>
					</div>
				)}

				<div style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#666" }}>
					<p>登録済み背景数: {availableBackgrounds.length}</p>
					<p>
						プレフィックス別: uSketch (
						{availableBackgrounds.filter((id) => id.startsWith("usketch.")).length}), カスタム (
						{availableBackgrounds.filter((id) => id.startsWith("custom.")).length})
					</p>
				</div>
			</div>

			<div style={{ flex: 1, position: "relative" }}>
				<WhiteboardCanvas
					background={
						selectedBgId === "inline.gradient"
							? {
									id: "inline.gradient",
									component: ({ camera }: BackgroundComponentProps) => (
										<div
											style={{
												position: "absolute",
												top: 0,
												left: 0,
												width: "100%",
												height: "100%",
												background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
												transform: `translate(${-camera.x}px, ${-camera.y}px) scale(${camera.zoom})`,
												transformOrigin: "0 0",
											}}
										/>
									),
								}
							: {
									id: selectedBgId,
									config: bgConfig,
								}
					}
				/>
			</div>
		</div>
	);
};
