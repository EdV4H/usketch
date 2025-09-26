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
		<div
			className="input-settings-overlay"
			onClick={onClose}
			onKeyDown={(e) => e.key === "Escape" && onClose()}
			role="button"
			tabIndex={0}
			aria-label="設定を閉じる"
		>
			<div
				className="input-settings-panel"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="入力設定パネル"
			>
				<div className="input-settings-header">
					<h2>入力設定</h2>
					<button type="button" className="close-button" onClick={onClose} aria-label="閉じる">
						×
					</button>
				</div>

				<div className="input-settings-tabs">
					<button
						type="button"
						className={`tab-button ${activeTab === "keyboard" ? "active" : ""}`}
						onClick={() => setActiveTab("keyboard")}
					>
						キーボード
					</button>
					<button
						type="button"
						className={`tab-button ${activeTab === "mouse" ? "active" : ""}`}
						onClick={() => setActiveTab("mouse")}
					>
						マウス
					</button>
					<button
						type="button"
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
