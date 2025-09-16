import type { SnapSettings } from "@usketch/store";
import type React from "react";
import { useState } from "react";
import { useStore } from "../hooks/use-store";

interface SnapSettingsProps {
	onClose?: () => void;
}

export const SnapSettingsPanel: React.FC<SnapSettingsProps> = ({ onClose }) => {
	const snapSettings = useStore((state) => state.snapSettings);
	const updateSnapSettings = useStore((state) => state.updateSnapSettings);

	const handleSettingChange = (key: keyof SnapSettings, value: boolean | number) => {
		updateSnapSettings({ [key]: value });
	};

	return (
		<div className="snap-settings-panel">
			<style>
				{`
					.snap-settings-panel {
						position: absolute;
						top: 100%;
						left: 0;
						margin-top: 8px;
						background: white;
						border: 1px solid #d0d0d0;
						border-radius: 8px;
						box-shadow: 0 4px 20px rgba(0,0,0,0.15);
						padding: 12px;
						min-width: 280px;
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
					
					.snap-settings-header {
						display: flex;
						justify-content: space-between;
						align-items: center;
						margin-bottom: 12px;
						padding-bottom: 8px;
						border-bottom: 1px solid #e0e0e0;
					}
					
					.snap-settings-title {
						font-size: 14px;
						font-weight: 600;
						color: #333;
					}
					
					.snap-settings-close {
						background: none;
						border: none;
						cursor: pointer;
						padding: 4px;
						color: #666;
						font-size: 18px;
						line-height: 1;
						transition: color 0.15s;
					}
					
					.snap-settings-close:hover {
						color: #333;
					}
					
					.snap-setting-group {
						margin-bottom: 12px;
					}
					
					.snap-setting-row {
						display: flex;
						justify-content: space-between;
						align-items: center;
						padding: 6px 0;
					}
					
					.snap-setting-label {
						font-size: 13px;
						color: #333;
						display: flex;
						align-items: center;
						gap: 8px;
					}
					
					.snap-setting-hint {
						font-size: 11px;
						color: #888;
						margin-left: 20px;
					}
					
					.snap-toggle {
						position: relative;
						width: 36px;
						height: 20px;
						background: #ccc;
						border-radius: 10px;
						cursor: pointer;
						transition: background-color 0.2s;
					}
					
					.snap-toggle.active {
						background: #0066cc;
					}
					
					.snap-toggle-handle {
						position: absolute;
						top: 2px;
						left: 2px;
						width: 16px;
						height: 16px;
						background: white;
						border-radius: 50%;
						transition: transform 0.2s;
						box-shadow: 0 2px 4px rgba(0,0,0,0.2);
					}
					
					.snap-toggle.active .snap-toggle-handle {
						transform: translateX(16px);
					}
					
					.snap-divider {
						height: 1px;
						background: #e0e0e0;
						margin: 12px 0;
					}
					
					.snap-number-input {
						width: 60px;
						padding: 4px 8px;
						border: 1px solid #d0d0d0;
						border-radius: 4px;
						font-size: 13px;
						text-align: right;
					}
					
					.snap-number-input:focus {
						outline: none;
						border-color: #0066cc;
						box-shadow: 0 0 0 3px rgba(0,102,204,0.1);
					}
					
					.keyboard-hint {
						margin-top: 12px;
						padding: 8px;
						background: #f5f5f5;
						border-radius: 4px;
						font-size: 12px;
						color: #666;
					}
					
					.keyboard-hint-title {
						font-weight: 600;
						margin-bottom: 4px;
					}
					
					.keyboard-hint-item {
						display: flex;
						justify-content: space-between;
						padding: 2px 0;
					}
					
					.keyboard-hint-key {
						font-family: monospace;
						background: white;
						padding: 2px 6px;
						border-radius: 3px;
						border: 1px solid #d0d0d0;
						font-size: 11px;
					}
				`}
			</style>

			<div className="snap-settings-header">
				<h3 className="snap-settings-title">スナップ設定</h3>
				{onClose && (
					<button
						type="button"
						className="snap-settings-close"
						onClick={onClose}
						aria-label="閉じる"
					>
						×
					</button>
				)}
			</div>

			<div className="snap-setting-group">
				<div className="snap-setting-row">
					<label className="snap-setting-label">スナップ有効</label>
					<button
						type="button"
						className={`snap-toggle ${snapSettings.enabled ? "active" : ""}`}
						onClick={() => handleSettingChange("enabled", !snapSettings.enabled)}
						aria-label="スナップ有効/無効"
					>
						<div className="snap-toggle-handle" />
					</button>
				</div>
			</div>

			<div className="snap-divider" />

			<div className="snap-setting-group">
				<div className="snap-setting-row">
					<label className="snap-setting-label">グリッドスナップ</label>
					<button
						type="button"
						className={`snap-toggle ${snapSettings.gridSnap ? "active" : ""}`}
						onClick={() => handleSettingChange("gridSnap", !snapSettings.gridSnap)}
						aria-label="グリッドスナップ有効/無効"
						disabled={!snapSettings.enabled}
					>
						<div className="snap-toggle-handle" />
					</button>
				</div>

				{snapSettings.gridSnap && (
					<div className="snap-setting-row">
						<label className="snap-setting-label">グリッドサイズ</label>
						<input
							type="number"
							className="snap-number-input"
							value={snapSettings.gridSize}
							onChange={(e) => handleSettingChange("gridSize", parseInt(e.target.value, 10) || 20)}
							min="5"
							max="100"
							step="5"
							disabled={!snapSettings.enabled}
						/>
					</div>
				)}
			</div>

			<div className="snap-setting-group">
				<div className="snap-setting-row">
					<label className="snap-setting-label">形状スナップ</label>
					<button
						type="button"
						className={`snap-toggle ${snapSettings.shapeSnap ? "active" : ""}`}
						onClick={() => handleSettingChange("shapeSnap", !snapSettings.shapeSnap)}
						aria-label="形状スナップ有効/無効"
						disabled={!snapSettings.enabled}
					>
						<div className="snap-toggle-handle" />
					</button>
				</div>
			</div>

			<div className="snap-setting-group">
				<div className="snap-setting-row">
					<label className="snap-setting-label">スナップガイド</label>
					<button
						type="button"
						className={`snap-toggle ${snapSettings.showGuides ? "active" : ""}`}
						onClick={() => handleSettingChange("showGuides", !snapSettings.showGuides)}
						aria-label="スナップガイド有効/無効"
						disabled={!snapSettings.enabled}
					>
						<div className="snap-toggle-handle" />
					</button>
				</div>

				<div className="snap-setting-row">
					<label className="snap-setting-label">整列ガイド</label>
					<button
						type="button"
						className={`snap-toggle ${snapSettings.showAlignmentGuides ? "active" : ""}`}
						onClick={() =>
							handleSettingChange("showAlignmentGuides", !snapSettings.showAlignmentGuides)
						}
						aria-label="整列ガイド有効/無効"
						disabled={!snapSettings.enabled}
					>
						<div className="snap-toggle-handle" />
					</button>
				</div>

				<div className="snap-setting-row">
					<label className="snap-setting-label">距離表示</label>
					<button
						type="button"
						className={`snap-toggle ${snapSettings.showDistances ? "active" : ""}`}
						onClick={() => handleSettingChange("showDistances", !snapSettings.showDistances)}
						aria-label="距離表示有効/無効"
						disabled={!snapSettings.enabled}
					>
						<div className="snap-toggle-handle" />
					</button>
				</div>
			</div>

			<div className="keyboard-hint">
				<div className="keyboard-hint-title">キーボードショートカット</div>
				<div className="keyboard-hint-item">
					<span>スナップ一時無効</span>
					<span className="keyboard-hint-key">Alt</span>
				</div>
				<div className="keyboard-hint-item">
					<span>グリッド切り替え</span>
					<span className="keyboard-hint-key">Shift + G</span>
				</div>
			</div>
		</div>
	);
};

interface SnapSettingsButtonProps {
	className?: string;
}

export const SnapSettingsButton: React.FC<SnapSettingsButtonProps> = ({ className = "" }) => {
	const [showSettings, setShowSettings] = useState(false);
	const snapSettings = useStore((state) => state.snapSettings);

	return (
		<div className={`snap-settings-container ${className}`} style={{ position: "relative" }}>
			<button
				type="button"
				className={`tool-button ${snapSettings.enabled ? "active" : ""}`}
				onClick={() => setShowSettings(!showSettings)}
				data-testid="snap-settings-button"
				title="スナップ設定"
			>
				<span className="tool-icon">⚡</span>
				<span>スナップ</span>
			</button>

			{showSettings && <SnapSettingsPanel onClose={() => setShowSettings(false)} />}
		</div>
	);
};
