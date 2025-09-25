import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import "./style-actions.css";

export const StyleActions: React.FC = () => {
	const copyStyleFromSelection = useWhiteboardStore((state) => state.copyStyleFromSelection);
	const pasteStyleToSelection = useWhiteboardStore((state) => state.pasteStyleToSelection);
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);
	const copiedStyle = useWhiteboardStore((state) => state.copiedStyle);

	const hasSelection = selectedShapeIds.size > 0;
	const hasCopiedStyle = copiedStyle !== null;

	return (
		<div className="style-actions">
			<button
				type="button"
				className="style-action-button"
				onClick={copyStyleFromSelection}
				disabled={!hasSelection}
				aria-label="選択した図形のスタイルをコピー"
			>
				<span className="action-icon">📋</span>
				<span className="action-label">スタイルをコピー</span>
			</button>

			<button
				type="button"
				className="style-action-button"
				onClick={pasteStyleToSelection}
				disabled={!hasSelection || !hasCopiedStyle}
				aria-label="コピーしたスタイルを選択した図形に適用"
			>
				<span className="action-icon">📄</span>
				<span className="action-label">スタイルを貼り付け</span>
			</button>
		</div>
	);
};
