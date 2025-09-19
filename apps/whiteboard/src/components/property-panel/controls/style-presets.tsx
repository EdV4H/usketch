import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useState } from "react";
import { ConfirmDialog } from "../dialogs/confirm-dialog";
import { InputDialog } from "../dialogs/input-dialog";
import "./style-presets.css";

export const StylePresets: React.FC = () => {
	const stylePresets = useWhiteboardStore((state) => state.stylePresets);
	const applyStylePreset = useWhiteboardStore((state) => state.applyStylePreset);
	const saveStylePreset = useWhiteboardStore((state) => state.saveStylePreset);
	const deleteStylePreset = useWhiteboardStore((state) => state.deleteStylePreset);
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);

	// Dialog states
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [presetToDelete, setPresetToDelete] = useState<string | null>(null);
	const [presetNameToDelete, setPresetNameToDelete] = useState<string>("");

	const handleSaveAsPreset = () => {
		setIsSaveDialogOpen(true);
	};

	const handleSaveConfirm = (name: string) => {
		saveStylePreset(name);
		setIsSaveDialogOpen(false);
	};

	const handleDeletePreset = (presetId: string, presetName: string) => {
		setPresetToDelete(presetId);
		setPresetNameToDelete(presetName);
		setIsDeleteDialogOpen(true);
	};

	const handleDeleteConfirm = () => {
		if (presetToDelete) {
			deleteStylePreset(presetToDelete);
		}
		setIsDeleteDialogOpen(false);
		setPresetToDelete(null);
		setPresetNameToDelete("");
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
							onClick={() => applyStylePreset(preset.id)}
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
								onClick={() => handleDeletePreset(preset.id, preset.name)}
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

			{/* Save Preset Dialog */}
			<InputDialog
				isOpen={isSaveDialogOpen}
				title="プリセットを保存"
				message="プリセット名を入力してください:"
				placeholder="例: マイスタイル"
				onConfirm={handleSaveConfirm}
				onCancel={() => setIsSaveDialogOpen(false)}
			/>

			{/* Delete Preset Confirm Dialog */}
			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				title="プリセットの削除"
				message={`「${presetNameToDelete}」プリセットを削除してもよろしいですか？`}
				confirmText="削除"
				cancelText="キャンセル"
				variant="danger"
				onConfirm={handleDeleteConfirm}
				onCancel={() => {
					setIsDeleteDialogOpen(false);
					setPresetToDelete(null);
					setPresetNameToDelete("");
				}}
			/>
		</div>
	);
};
