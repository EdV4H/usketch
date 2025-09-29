import { keyboardPresets, mousePresets } from "@usketch/input-presets";
import { useInput } from "@usketch/react-canvas";
import { useEffect, useState } from "react";

interface PresetInfo {
	id: string;
	name: string;
	description: string;
	isActive: boolean;
}

export function PresetSelector() {
	const { keyboard, mouse } = useInput();
	const [selectedKeyboardPreset, setSelectedKeyboardPreset] = useState("default");
	const [selectedMousePreset, setSelectedMousePreset] = useState("default");
	const [keyboardPresetList, setKeyboardPresetList] = useState<PresetInfo[]>([]);
	const [mousePresetList, setMousePresetList] = useState<PresetInfo[]>([]);

	useEffect(() => {
		// LocalStorageから現在のプリセットを読み込み
		const savedKeyboardPreset = localStorage.getItem("keyboardPreset") || "default";
		const savedMousePreset = localStorage.getItem("mousePreset") || "default";
		setSelectedKeyboardPreset(savedKeyboardPreset);
		setSelectedMousePreset(savedMousePreset);

		// プリセット一覧を作成
		const kbPresets: PresetInfo[] = Object.values(keyboardPresets).map((preset) => ({
			id: preset.id,
			name: preset.name,
			description: preset.description,
			isActive: preset.id === savedKeyboardPreset,
		}));

		const msPresets: PresetInfo[] = Object.values(mousePresets).map((preset) => ({
			id: preset.id,
			name: preset.name,
			description: preset.description,
			isActive: preset.id === savedMousePreset,
		}));

		setKeyboardPresetList(kbPresets);
		setMousePresetList(msPresets);
	}, []);

	const handleKeyboardPresetChange = (presetId: string) => {
		if (!keyboard) return;

		const preset = keyboardPresets[presetId];
		if (!preset) return;

		// プリセットのバインディングを適用
		Object.entries(preset.bindings).forEach(([command, keys]) => {
			keyboard.setBinding(command, keys);
		});

		// LocalStorageに保存
		localStorage.setItem("keyboardPreset", presetId);
		setSelectedKeyboardPreset(presetId);

		// カスタムバインディングをクリア（オプション）
		const clearCustom = window.confirm(
			"カスタムキーバインディングをクリアしてプリセットを適用しますか？",
		);
		if (clearCustom) {
			localStorage.removeItem("customKeyboardBindings");
		}

		// ページをリロードして変更を反映
		window.location.reload();
	};

	const handleMousePresetChange = (presetId: string) => {
		if (!mouse) return;

		const preset = mousePresets[presetId];
		if (!preset) return;

		// プリセットのバインディングを適用
		Object.entries(preset.bindings).forEach(([command, binding]) => {
			mouse.setBinding(command, { ...binding, command });
		});

		// LocalStorageに保存
		localStorage.setItem("mousePreset", presetId);
		setSelectedMousePreset(presetId);

		// ページをリロードして変更を反映
		window.location.reload();
	};

	const exportSettings = () => {
		const settings = {
			keyboardPreset: selectedKeyboardPreset,
			mousePreset: selectedMousePreset,
			customKeyboardBindings: JSON.parse(localStorage.getItem("customKeyboardBindings") || "{}"),
			pinchSensitivity: localStorage.getItem("pinchSensitivity") || "1",
			rotateSensitivity: localStorage.getItem("rotateSensitivity") || "1",
			exportDate: new Date().toISOString(),
		};

		const blob = new Blob([JSON.stringify(settings, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "input-settings.json";
		a.click();
		URL.revokeObjectURL(url);
	};

	const importSettings = () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.onchange = async (e) => {
			const file = (e.target as HTMLInputElement).files?.[0];
			if (!file) return;

			try {
				const text = await file.text();
				const settings = JSON.parse(text);

				// 設定を適用
				if (settings.keyboardPreset) {
					localStorage.setItem("keyboardPreset", settings.keyboardPreset);
				}
				if (settings.mousePreset) {
					localStorage.setItem("mousePreset", settings.mousePreset);
				}
				if (settings.customKeyboardBindings) {
					localStorage.setItem(
						"customKeyboardBindings",
						JSON.stringify(settings.customKeyboardBindings),
					);
				}
				if (settings.pinchSensitivity) {
					localStorage.setItem("pinchSensitivity", settings.pinchSensitivity);
				}
				if (settings.rotateSensitivity) {
					localStorage.setItem("rotateSensitivity", settings.rotateSensitivity);
				}

				// Apply settings dynamically
				if (settings.keyboardPreset && keyboard) {
					const kbPreset = keyboardPresets[settings.keyboardPreset];
					if (kbPreset) keyboard.initialize({ preset: kbPreset });
					setSelectedKeyboardPreset(settings.keyboardPreset);
				}
				if (settings.mousePreset && mouse) {
					const msPreset = mousePresets[settings.mousePreset];
					if (msPreset) mouse.initialize({ preset: msPreset });
					setSelectedMousePreset(settings.mousePreset);
				}
			} catch (error) {
				console.error("設定のインポートに失敗しました:", error);
				alert("設定ファイルの読み込みに失敗しました。");
			}
		};
		input.click();
	};

	const resetAllSettings = () => {
		if (!window.confirm("すべての入力設定をデフォルトに戻しますか？この操作は取り消せません。")) {
			return;
		}

		// すべての設定をクリア
		localStorage.removeItem("keyboardPreset");
		localStorage.removeItem("mousePreset");
		localStorage.removeItem("customKeyboardBindings");
		localStorage.removeItem("pinchSensitivity");
		localStorage.removeItem("rotateSensitivity");

		// Apply default settings dynamically
		if (keyboard && keyboardPresets.default) {
			keyboard.initialize({ preset: keyboardPresets.default });
			setSelectedKeyboardPreset("default");
		}
		if (mouse && mousePresets.default) {
			mouse.initialize({ preset: mousePresets.default });
			setSelectedMousePreset("default");
		}
	};

	return (
		<div className="preset-selector">
			<div className="preset-section">
				<h3>キーボードプリセット</h3>
				<div className="preset-list">
					{keyboardPresetList.map((preset) => (
						<div
							key={preset.id}
							className={`preset-item ${selectedKeyboardPreset === preset.id ? "active" : ""}`}
							onClick={() => handleKeyboardPresetChange(preset.id)}
							onKeyDown={(e) => e.key === "Enter" && handleKeyboardPresetChange(preset.id)}
							role="button"
							tabIndex={0}
							aria-label={`${preset.name}プリセットを選択`}
						>
							<div className="preset-header">
								<input
									type="radio"
									name="keyboard-preset"
									checked={selectedKeyboardPreset === preset.id}
									onChange={() => handleKeyboardPresetChange(preset.id)}
									onClick={(e) => e.stopPropagation()}
								/>
								<span className="preset-name">{preset.name}</span>
							</div>
							<p className="preset-description">{preset.description}</p>
						</div>
					))}
				</div>
			</div>

			<div className="preset-section">
				<h3>マウスプリセット</h3>
				<div className="preset-list">
					{mousePresetList.map((preset) => (
						<div
							key={preset.id}
							className={`preset-item ${selectedMousePreset === preset.id ? "active" : ""}`}
							onClick={() => handleMousePresetChange(preset.id)}
							onKeyDown={(e) => e.key === "Enter" && handleMousePresetChange(preset.id)}
							role="button"
							tabIndex={0}
							aria-label={`${preset.name}プリセットを選択`}
						>
							<div className="preset-header">
								<input
									type="radio"
									name="mouse-preset"
									checked={selectedMousePreset === preset.id}
									onChange={() => handleMousePresetChange(preset.id)}
									onClick={(e) => e.stopPropagation()}
								/>
								<span className="preset-name">{preset.name}</span>
							</div>
							<p className="preset-description">{preset.description}</p>
						</div>
					))}
				</div>
			</div>

			<div className="preset-actions">
				<h3>設定管理</h3>
				<div className="action-buttons">
					<button type="button" className="export-button" onClick={exportSettings}>
						設定をエクスポート
					</button>
					<button type="button" className="import-button" onClick={importSettings}>
						設定をインポート
					</button>
					<button type="button" className="reset-button" onClick={resetAllSettings}>
						すべてリセット
					</button>
				</div>
				<div className="action-info">
					<p>設定をファイルとして保存し、他の環境で復元できます。</p>
				</div>
			</div>
		</div>
	);
}
