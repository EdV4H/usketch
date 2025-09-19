import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import "./style-presets.css";

export const StylePresets: React.FC = () => {
	const stylePresets = useWhiteboardStore((state) => state.stylePresets);
	const applyPreset = useWhiteboardStore((state) => state.applyPreset);
	const saveAsPreset = useWhiteboardStore((state) => state.saveAsPreset);
	const deletePreset = useWhiteboardStore((state) => state.deletePreset);
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);

	const handleSaveAsPreset = () => {
		const name = prompt("プリセット名を入力してください:");
		if (name) {
			saveAsPreset(name);
		}
	};

	const handleDeletePreset = (presetId: string) => {
		if (confirm("このプリセットを削除しますか？")) {
			deletePreset(presetId);
		}
	};

	const hasSelection = selectedShapeIds.size > 0;

	return (
		<div className="style-presets">
			<div className="preset-header">
				<h4 className="preset-title">スタイルプリセット</h4>
				{hasSelection && (
					<button
						type="button"
						className="save-preset-button"
						onClick={handleSaveAsPreset}
						aria-label="現在のスタイルをプリセットとして保存"
					>
						+ 保存
					</button>
				)}
			</div>

			<div className="preset-grid">
				{stylePresets.map((preset) => (
					<div key={preset.id} className="preset-item">
						<button
							type="button"
							className="preset-button"
							onClick={() => applyPreset(preset.id)}
							disabled={!hasSelection}
							aria-label={`プリセット「${preset.name}」を適用`}
						>
							<div className="preset-preview">
								<div
									className="preview-fill"
									style={{
										backgroundColor: preset.style.fillColor,
										opacity: preset.style.opacity,
									}}
								/>
								<div
									className="preview-stroke"
									style={{
										borderColor: preset.style.strokeColor,
										borderWidth: `${Math.min(preset.style.strokeWidth, 3)}px`,
									}}
								/>
							</div>
							<span className="preset-name">{preset.name}</span>
						</button>
						{!preset.isDefault && (
							<button
								type="button"
								className="delete-preset-button"
								onClick={() => handleDeletePreset(preset.id)}
								aria-label={`プリセット「${preset.name}」を削除`}
							>
								×
							</button>
						)}
					</div>
				))}
			</div>

			{stylePresets.length === 0 && (
				<div className="preset-empty-state">
					<p>プリセットがありません</p>
					<p className="preset-hint">
						図形を選択してスタイルを設定し、「+ 保存」をクリックしてプリセットを作成
					</p>
				</div>
			)}
		</div>
	);
};
