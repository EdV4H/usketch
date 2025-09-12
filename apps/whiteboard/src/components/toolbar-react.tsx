import { whiteboardStore } from "@usketch/store";
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
	const [showEffectMenu, setShowEffectMenu] = useState(false);
	const [currentEffectType, setCurrentEffectType] = useState<"ripple" | "pin" | "fading-pin">(
		"ripple",
	);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const effectDropdownRef = useRef<HTMLDivElement>(null);

	const tools = [
		{ id: "select", name: "選択", icon: "↖" },
		{ id: "rectangle", name: "四角形", icon: "□" },
		{ id: "ellipse", name: "楕円", icon: "○" },
		{ id: "line", name: "線", icon: "╱" },
		{ id: "arrow", name: "矢印", icon: "→" },
		{ id: "draw", name: "描画", icon: "✏" },
		{ id: "text", name: "テキスト", icon: "T" },
		{ id: "effect", name: "エフェクト", icon: "✨" },
	];

	const handleBackgroundSelect = (bgId: string, config?: any) => {
		setCurrentBackground(bgId);
		if (onBackgroundChange) {
			onBackgroundChange({ id: bgId, config });
		}
		setShowBackgroundMenu(false);
	};

	// effectToolConfigを更新
	useEffect(() => {
		if (currentTool === "effect") {
			const effectConfig =
				currentEffectType === "ripple"
					? { color: "#4ECDC4", radius: 60, duration: 600 }
					: currentEffectType === "pin"
						? { color: "#ff6b6b", size: 24, message: "Click to add comment" }
						: {
								color: "#9b59b6",
								size: 24,
								message: "Temporary note",
								fadeDelay: 3000,
								fadeDuration: 5000,
							};

			const { setEffectToolConfig } = whiteboardStore.getState();
			setEffectToolConfig({
				effectType: currentEffectType,
				effectConfig,
			});
		}
	}, [currentTool, currentEffectType]);

	// 外側クリックでメニューを閉じる
	useEffect(() => {
		if (!showBackgroundMenu && !showEffectMenu) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setShowBackgroundMenu(false);
			}
			if (effectDropdownRef.current && !effectDropdownRef.current.contains(event.target as Node)) {
				setShowEffectMenu(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showBackgroundMenu, showEffectMenu]);

	return (
		<div className="toolbar">
			<style>
				{`
					.toolbar {
						display: flex;
						align-items: center;
						padding: 0.75rem 1rem;
						background: white;
						border-bottom: 1px solid #e0e0e0;
						gap: 0.75rem;
						box-shadow: 0 1px 3px rgba(0,0,0,0.08);
						min-height: 56px;
						position: relative;
						z-index: 100;
					}
					.toolbar-group {
						display: flex;
						gap: 0.375rem;
						align-items: center;
						flex-wrap: nowrap;
					}
					.toolbar-separator {
						width: 1px;
						height: 28px;
						background: #e0e0e0;
						margin: 0 0.25rem;
						flex-shrink: 0;
					}
					.tool-button {
						padding: 0.375rem 0.625rem;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 6px;
						cursor: pointer;
						font-size: 13px;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						gap: 0.375rem;
						transition: all 0.15s ease;
						white-space: nowrap;
						height: 36px;
						min-width: fit-content;
						font-weight: 500;
						color: #333;
						position: relative;
					}
					.tool-button:hover {
						background: #f7f7f7;
						border-color: #999;
						transform: translateY(-1px);
						box-shadow: 0 2px 4px rgba(0,0,0,0.08);
					}
					.tool-button:active {
						transform: translateY(0);
						box-shadow: 0 1px 2px rgba(0,0,0,0.08);
					}
					.tool-button.active {
						background: linear-gradient(135deg, #0066cc, #0052a3);
						color: white;
						border-color: #0052a3;
						box-shadow: 0 2px 6px rgba(0,102,204,0.3);
					}
					.tool-button.active:hover {
						background: linear-gradient(135deg, #0052a3, #004080);
						border-color: #004080;
						transform: translateY(-1px);
						box-shadow: 0 3px 8px rgba(0,102,204,0.4);
					}
					.tool-icon {
						font-size: 18px;
						line-height: 1;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						width: 20px;
						height: 20px;
					}
					.background-dropdown {
						position: relative;
						display: inline-flex;
					}
					.background-button {
						padding: 0.375rem 0.75rem;
						padding-right: 2rem;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 6px;
						cursor: pointer;
						font-size: 13px;
						display: inline-flex;
						align-items: center;
						gap: 0.5rem;
						min-width: 140px;
						height: 36px;
						justify-content: space-between;
						font-weight: 500;
						color: #333;
						transition: all 0.15s ease;
						white-space: nowrap;
						position: relative;
						appearance: none;
						background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
						background-repeat: no-repeat;
						background-position: right 0.5rem center;
						background-size: 20px;
					}
					.background-button:hover {
						background-color: #f7f7f7;
						border-color: #999;
						box-shadow: 0 2px 4px rgba(0,0,0,0.08);
					}
					.background-button:focus {
						outline: none;
						border-color: #0066cc;
						box-shadow: 0 0 0 3px rgba(0,102,204,0.1);
					}
					.background-button:active {
						box-shadow: 0 1px 2px rgba(0,0,0,0.08);
					}
					.background-button.open {
						border-color: #0066cc;
						box-shadow: 0 0 0 3px rgba(0,102,204,0.1);
					}
					.background-button > span:last-child {
						display: none;
					}
					.background-menu {
						position: absolute;
						top: calc(100% + 4px);
						left: 0;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 8px;
						box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 1px rgba(0,0,0,0.1);
						min-width: 220px;
						max-height: 320px;
						overflow-y: auto;
						overflow-x: hidden;
						z-index: 1000;
						animation: slideDown 0.2s cubic-bezier(0.4, 0, 0.2, 1);
					}
					@keyframes slideDown {
						from {
							opacity: 0;
							transform: translateY(-4px) scale(0.98);
						}
						to {
							opacity: 1;
							transform: translateY(0) scale(1);
						}
					}
					.background-menu::-webkit-scrollbar {
						width: 6px;
					}
					.background-menu::-webkit-scrollbar-track {
						background: transparent;
					}
					.background-menu::-webkit-scrollbar-thumb {
						background: #d0d0d0;
						border-radius: 3px;
					}
					.background-menu::-webkit-scrollbar-thumb:hover {
						background: #999;
					}
					.background-section {
						padding: 0.375rem 0;
						border-bottom: 1px solid #e8e8e8;
					}
					.background-section:last-child {
						border-bottom: none;
					}
					.background-section:first-child {
						padding-top: 0.5rem;
					}
					.background-section-title {
						padding: 0.25rem 1rem;
						margin-bottom: 0.25rem;
						font-size: 10px;
						color: #888;
						font-weight: 600;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					.background-item {
						/* ボタンのデフォルトスタイルをリセット */
						appearance: none;
						background: none;
						border: none;
						margin: 0;
						font-family: inherit;
						text-align: left;
						width: 100%;
						
						/* カスタムスタイル */
						padding: 0.625rem 1rem;
						padding-left: 2.25rem;
						cursor: pointer;
						font-size: 13px;
						display: flex;
						align-items: flex-start;
						gap: 0.5rem;
						transition: all 0.1s ease;
						position: relative;
						color: #333;
						min-height: 36px;
						line-height: 1.4;
					}
					.background-item:hover {
						background: #f7f7f7;
					}
					.background-item:focus {
						outline: none;
						background: #f0f0f0;
					}
					.background-item:focus-visible {
						outline: 2px solid #0066cc;
						outline-offset: -2px;
					}
					.background-item.active {
						background: linear-gradient(to right, #e8f4ff, transparent);
						font-weight: 600;
						color: #0066cc;
					}
					.background-item.active::before {
						content: "✓";
						position: absolute;
						left: 0.875rem;
						color: #0066cc;
						font-weight: bold;
						font-size: 14px;
					}
					.background-item:not(.active):hover {
						background: #f7f7f7;
					}
					.background-item:active {
						background: #e8e8e8;
					}
					
					/* レスポンシブ調整 */
					@media (max-width: 768px) {
						.toolbar {
							padding: 0.5rem;
							gap: 0.5rem;
							overflow-x: auto;
						}
						.tool-button span:not(.tool-icon) {
							display: none;
						}
						.tool-button {
							min-width: 40px;
							padding: 0.5rem;
						}
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

			{currentTool === "effect" && (
				<>
					<div className="toolbar-group">
						<div className="background-dropdown" ref={effectDropdownRef}>
							<button
								type="button"
								className={`background-button ${showEffectMenu ? "open" : ""}`}
								onClick={() => setShowEffectMenu(!showEffectMenu)}
								data-testid="effect-type-button"
								title="エフェクトタイプを選択"
							>
								<span>
									{currentEffectType === "ripple"
										? "波紋エフェクト"
										: currentEffectType === "pin"
											? "ピンマーカー"
											: "消えるピン"}
								</span>
								<span>▼</span>
							</button>

							{showEffectMenu && (
								<div className="background-menu">
									<div className="background-section">
										<div className="background-section-title">エフェクトタイプ</div>
										<button
											type="button"
											className={`background-item ${currentEffectType === "ripple" ? "active" : ""}`}
											onClick={() => {
												setCurrentEffectType("ripple");
												setShowEffectMenu(false);

												// Also update Store config immediately
												const effectConfig = { color: "#4ECDC4", radius: 60, duration: 600 };
												const { setEffectToolConfig } = whiteboardStore.getState();
												setEffectToolConfig({
													effectType: "ripple",
													effectConfig,
												});
											}}
										>
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													alignItems: "flex-start",
													gap: "2px",
												}}
											>
												<span>波紋エフェクト</span>
												<span style={{ fontSize: "11px", color: "#888", fontWeight: "normal" }}>
													クリック時に波紋が広がる
												</span>
											</div>
										</button>
										<button
											type="button"
											className={`background-item ${currentEffectType === "pin" ? "active" : ""}`}
											onClick={() => {
												setCurrentEffectType("pin");
												setShowEffectMenu(false);

												// Also update Store config immediately
												const effectConfig = {
													color: "#ff6b6b",
													size: 24,
													message: "Click to add comment",
												};
												const { setEffectToolConfig } = whiteboardStore.getState();
												setEffectToolConfig({
													effectType: "pin",
													effectConfig,
												});
											}}
										>
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													alignItems: "flex-start",
													gap: "2px",
												}}
											>
												<span>ピンマーカー</span>
												<span style={{ fontSize: "11px", color: "#888", fontWeight: "normal" }}>
													固定のピンを配置
												</span>
											</div>
										</button>
										<button
											type="button"
											className={`background-item ${currentEffectType === "fading-pin" ? "active" : ""}`}
											onClick={() => {
												setCurrentEffectType("fading-pin");
												setShowEffectMenu(false);

												// Also update Store config immediately
												const effectConfig = {
													color: "#9b59b6",
													size: 24,
													message: "Temporary note",
													fadeDelay: 3000,
													fadeDuration: 5000,
												};
												const { setEffectToolConfig } = whiteboardStore.getState();
												setEffectToolConfig({
													effectType: "fading-pin",
													effectConfig,
												});
											}}
										>
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													alignItems: "flex-start",
													gap: "2px",
												}}
											>
												<span>消えるピン</span>
												<span style={{ fontSize: "11px", color: "#888", fontWeight: "normal" }}>
													5秒後に自動で消える
												</span>
											</div>
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
					<div className="toolbar-separator" />
				</>
			)}

			<div className="toolbar-group">
				<div className="background-dropdown" ref={dropdownRef}>
					<button
						type="button"
						className={`background-button ${showBackgroundMenu ? "open" : ""}`}
						onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
						data-testid="background-button"
						title="背景パターンを選択"
					>
						<span>
							{currentBackground === "none"
								? "背景なし"
								: PRESET_BACKGROUNDS[currentBackground as keyof typeof PRESET_BACKGROUNDS]?.name ||
									CUSTOM_BACKGROUNDS_METADATA[
										currentBackground as keyof typeof CUSTOM_BACKGROUNDS_METADATA
									]?.name ||
									"背景"}
						</span>
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
