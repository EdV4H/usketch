import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CUSTOM_BACKGROUNDS_METADATA } from "../backgrounds/register-backgrounds";
import { useStore } from "../hooks/use-store";

export interface ToolbarProps {
	onBackgroundChange?: (background: { id: string; config?: any }) => void;
}

// プリセット背景の設定
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

export const ToolbarReact: React.FC<ToolbarProps> = ({ onBackgroundChange }) => {
	const currentTool = useStore((state) => state.currentTool);
	const setCurrentTool = useStore((state) => state.setCurrentTool);
	const [currentBackground, setCurrentBackground] = useState("usketch.dots");
	const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const tools = [
		{ id: "select", name: "選択", icon: "↖" },
		{ id: "rectangle", name: "四角形", icon: "□" },
		{ id: "ellipse", name: "楕円", icon: "○" },
		{ id: "line", name: "線", icon: "╱" },
		{ id: "arrow", name: "矢印", icon: "→" },
		{ id: "draw", name: "描画", icon: "✏" },
		{ id: "text", name: "テキスト", icon: "T" },
	];

	const handleBackgroundSelect = (bgId: string, config?: any) => {
		setCurrentBackground(bgId);
		if (onBackgroundChange) {
			onBackgroundChange({ id: bgId, config });
		}
		setShowBackgroundMenu(false);
	};

	// 外側クリックでメニューを閉じる
	useEffect(() => {
		if (!showBackgroundMenu) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setShowBackgroundMenu(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showBackgroundMenu]);

	return (
		<div className="toolbar">
			<style>
				{`
					.toolbar {
						display: flex;
						align-items: center;
						padding: 0.5rem 1rem;
						background: white;
						border-bottom: 1px solid #e0e0e0;
						gap: 1rem;
						box-shadow: 0 1px 3px rgba(0,0,0,0.1);
					}
					.toolbar-group {
						display: flex;
						gap: 0.25rem;
						align-items: center;
					}
					.toolbar-separator {
						width: 1px;
						height: 24px;
						background: #e0e0e0;
					}
					.tool-button {
						padding: 0.5rem 0.75rem;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 4px;
						cursor: pointer;
						font-size: 14px;
						display: flex;
						align-items: center;
						gap: 0.25rem;
						transition: all 0.2s;
					}
					.tool-button:hover {
						background: #f5f5f5;
						border-color: #999;
					}
					.tool-button.active {
						background: #007acc;
						color: white;
						border-color: #0066aa;
					}
					.tool-icon {
						font-size: 16px;
						line-height: 1;
					}
					.background-dropdown {
						position: relative;
					}
					.background-button {
						padding: 0.5rem 1rem;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 4px;
						cursor: pointer;
						font-size: 14px;
						display: flex;
						align-items: center;
						gap: 0.5rem;
						min-width: 150px;
						justify-content: space-between;
					}
					.background-button:hover {
						background: #f5f5f5;
						border-color: #999;
					}
					.background-menu {
						position: absolute;
						top: 100%;
						left: 0;
						margin-top: 4px;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 4px;
						box-shadow: 0 4px 12px rgba(0,0,0,0.15);
						min-width: 200px;
						max-height: 400px;
						overflow-y: auto;
						z-index: 1000;
					}
					.background-section {
						padding: 0.5rem 0;
						border-bottom: 1px solid #e0e0e0;
					}
					.background-section:last-child {
						border-bottom: none;
					}
					.background-section-title {
						padding: 0.25rem 1rem;
						font-size: 11px;
						color: #666;
						font-weight: 600;
						text-transform: uppercase;
					}
					.background-item {
						padding: 0.5rem 1rem;
						cursor: pointer;
						font-size: 14px;
						display: flex;
						align-items: center;
						gap: 0.5rem;
						transition: background 0.1s;
					}
					.background-item:hover {
						background: #f5f5f5;
					}
					.background-item.active {
						background: #e8f4ff;
						font-weight: 500;
					}
					.background-item.active::before {
						content: "✓";
						color: #007acc;
						font-weight: bold;
						margin-right: 0.25rem;
					}
				`}
			</style>

			<div className="toolbar-group">
				{tools.map((tool) => (
					<button
						type="button"
						key={tool.id}
						className={`tool-button ${currentTool === tool.id ? "active" : ""}`}
						onClick={() => setCurrentTool(tool.id)}
						data-testid={`tool-${tool.id}`}
						title={tool.name}
					>
						<span className="tool-icon">{tool.icon}</span>
						<span>{tool.name}</span>
					</button>
				))}
			</div>

			<div className="toolbar-separator" />

			<div className="toolbar-group">
				<div className="background-dropdown" ref={dropdownRef}>
					<button
						type="button"
						className="background-button"
						onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
						data-testid="background-button"
					>
						<span>背景</span>
						<span>▼</span>
					</button>

					{showBackgroundMenu && (
						<div className="background-menu">
							<div className="background-section">
								<div className="background-section-title">プリセット</div>
								{Object.entries(PRESET_BACKGROUNDS).map(([id, bg]) => (
									<button
										type="button"
										key={id}
										className={`background-item ${currentBackground === id ? "active" : ""}`}
										onClick={() => handleBackgroundSelect(id, bg.config)}
									>
										{bg.name}
									</button>
								))}
							</div>

							<div className="background-section">
								<div className="background-section-title">カスタム</div>
								{Object.entries(CUSTOM_BACKGROUNDS_METADATA).map(([id, bg]) => (
									<button
										type="button"
										key={id}
										className={`background-item ${currentBackground === id ? "active" : ""}`}
										onClick={() => handleBackgroundSelect(id)}
									>
										{bg.name}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
