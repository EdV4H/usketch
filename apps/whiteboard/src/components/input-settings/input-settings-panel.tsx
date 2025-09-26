import { useState } from "react";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { MouseBindings } from "./mouse-bindings";
import { PresetSelector } from "./preset-selector";
import "./input-settings.css";

interface InputSettingsPanelProps {
	isOpen: boolean;
	onClose: () => void;
}

type TabType = "keyboard" | "mouse" | "presets";

export function InputSettingsPanel({ isOpen, onClose }: InputSettingsPanelProps) {
	const [activeTab, setActiveTab] = useState<TabType>("keyboard");

	if (!isOpen) return null;

	return (
		<div className="input-settings-overlay" onClick={onClose}>
			<div className="input-settings-panel" onClick={(e) => e.stopPropagation()}>
				<div className="input-settings-header">
					<h2>入力設定</h2>
					<button className="close-button" onClick={onClose} aria-label="閉じる">
						×
					</button>
				</div>

				<div className="input-settings-tabs">
					<button
						className={`tab-button ${activeTab === "keyboard" ? "active" : ""}`}
						onClick={() => setActiveTab("keyboard")}
					>
						キーボード
					</button>
					<button
						className={`tab-button ${activeTab === "mouse" ? "active" : ""}`}
						onClick={() => setActiveTab("mouse")}
					>
						マウス
					</button>
					<button
						className={`tab-button ${activeTab === "presets" ? "active" : ""}`}
						onClick={() => setActiveTab("presets")}
					>
						プリセット
					</button>
				</div>

				<div className="input-settings-content">
					{activeTab === "keyboard" && <KeyboardShortcuts />}
					{activeTab === "mouse" && <MouseBindings />}
					{activeTab === "presets" && <PresetSelector />}
				</div>
			</div>
		</div>
	);
}
