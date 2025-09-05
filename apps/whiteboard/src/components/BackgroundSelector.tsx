import type React from "react";
import { useState } from "react";
import { CUSTOM_BACKGROUNDS_METADATA } from "../backgrounds/registerBackgrounds";

interface BackgroundSelectorProps {
	currentBackground: { id: string; config?: any };
	onBackgroundChange: (background: { id: string; config?: any }) => void;
}

// uSketch プリセット背景の設定
const PRESET_BACKGROUNDS = {
	none: {
		name: "なし",
		config: undefined,
	},
	"usketch.dots": {
		name: "ドット",
		config: { spacing: 20, size: 2, color: "#d0d0d0" },
	},
	"usketch.grid": {
		name: "グリッド",
		config: { size: 40, color: "#e0e0e0", thickness: 1 },
	},
	"usketch.lines": {
		name: "ライン",
		config: { direction: "horizontal", spacing: 40, color: "#e0e0e0", thickness: 1 },
	},
	"usketch.isometric": {
		name: "アイソメトリック",
		config: { size: 40, color: "#e0e0e0" },
	},
};

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
	currentBackground,
	onBackgroundChange,
}) => {
	const [selectedCategory, setSelectedCategory] = useState<"preset" | "custom">("preset");
	const [showConfig, setShowConfig] = useState(false);

	const handleBackgroundSelect = (id: string, defaultConfig?: any) => {
		onBackgroundChange({ id, config: defaultConfig });
	};

	const handleConfigChange = (key: string, value: any) => {
		onBackgroundChange({
			...currentBackground,
			config: {
				...currentBackground.config,
				[key]: value,
			},
		});
	};

	return (
		<div className="background-selector">
			<style>
				{`
					.background-selector {
						padding: 1rem;
						background: white;
						border: 1px solid #e0e0e0;
						border-radius: 8px;
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
					}
					.category-tabs {
						display: flex;
						gap: 0.5rem;
						margin-bottom: 1rem;
						border-bottom: 2px solid #e0e0e0;
					}
					.category-tab {
						padding: 0.5rem 1rem;
						background: none;
						border: none;
						cursor: pointer;
						font-size: 14px;
						color: #666;
						transition: all 0.2s;
						border-bottom: 2px solid transparent;
						margin-bottom: -2px;
					}
					.category-tab:hover {
						color: #333;
					}
					.category-tab.active {
						color: #007acc;
						border-bottom-color: #007acc;
						font-weight: 600;
					}
					.background-grid {
						display: grid;
						grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
						gap: 0.5rem;
						margin-bottom: 1rem;
					}
					.background-item {
						padding: 0.75rem;
						border: 2px solid #e0e0e0;
						border-radius: 6px;
						cursor: pointer;
						text-align: center;
						font-size: 12px;
						transition: all 0.2s;
						background: white;
					}
					.background-item:hover {
						border-color: #007acc;
						transform: translateY(-2px);
						box-shadow: 0 2px 8px rgba(0, 122, 204, 0.2);
					}
					.background-item.active {
						border-color: #007acc;
						background: #f0f8ff;
						font-weight: 600;
					}
					.config-section {
						margin-top: 1rem;
						padding-top: 1rem;
						border-top: 1px solid #e0e0e0;
					}
					.config-toggle {
						padding: 0.25rem 0.5rem;
						background: #f0f0f0;
						border: 1px solid #d0d0d0;
						border-radius: 4px;
						cursor: pointer;
						font-size: 12px;
						margin-bottom: 0.5rem;
					}
					.config-toggle:hover {
						background: #e0e0e0;
					}
					.config-grid {
						display: grid;
						grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
						gap: 0.5rem;
					}
					.config-item {
						display: flex;
						flex-direction: column;
						gap: 0.25rem;
					}
					.config-label {
						font-size: 11px;
						color: #666;
						font-weight: 500;
					}
					.config-input {
						padding: 0.25rem 0.5rem;
						border: 1px solid #d0d0d0;
						border-radius: 4px;
						font-size: 12px;
					}
					.config-input:focus {
						outline: none;
						border-color: #007acc;
					}
				`}
			</style>

			<div className="category-tabs">
				<button
					type="button"
					className={`category-tab ${selectedCategory === "preset" ? "active" : ""}`}
					onClick={() => setSelectedCategory("preset")}
				>
					プリセット
				</button>
				<button
					type="button"
					className={`category-tab ${selectedCategory === "custom" ? "active" : ""}`}
					onClick={() => setSelectedCategory("custom")}
				>
					カスタム
				</button>
			</div>

			<div className="background-grid">
				{selectedCategory === "preset"
					? Object.entries(PRESET_BACKGROUNDS).map(([id, bg]) => (
							<div
								key={id}
								className={`background-item ${currentBackground.id === id ? "active" : ""}`}
								onClick={() => handleBackgroundSelect(id, bg.config)}
							>
								{bg.name}
							</div>
						))
					: Object.entries(CUSTOM_BACKGROUNDS_METADATA).map(([id, bg]) => (
							<div
								key={id}
								className={`background-item ${currentBackground.id === id ? "active" : ""}`}
								onClick={() => handleBackgroundSelect(id)}
							>
								{bg.name}
							</div>
						))}
			</div>

			{currentBackground.config && (
				<div className="config-section">
					<button
						type="button"
						className="config-toggle"
						onClick={() => setShowConfig(!showConfig)}
					>
						{showConfig ? "設定を隠す" : "設定を表示"}
					</button>

					{showConfig && (
						<div className="config-grid">
							{Object.entries(currentBackground.config).map(([key, value]) => (
								<div key={key} className="config-item">
									<label className="config-label">{key}:</label>
									{typeof value === "number" ? (
										<input
											className="config-input"
											type="number"
											value={value}
											onChange={(e) => handleConfigChange(key, Number(e.target.value))}
										/>
									) : typeof value === "string" && key.toLowerCase().includes("color") ? (
										<input
											className="config-input"
											type="color"
											value={value}
											onChange={(e) => handleConfigChange(key, e.target.value)}
										/>
									) : (
										<input
											className="config-input"
											type="text"
											value={value}
											onChange={(e) => handleConfigChange(key, e.target.value)}
										/>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
};
