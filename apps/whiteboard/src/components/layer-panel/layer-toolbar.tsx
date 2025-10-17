import { useWhiteboardStore } from "@usketch/store";
import type React from "react";

/**
 * レイヤーツールバーコンポーネント
 * グループ化などのレイヤー操作ボタンを提供
 */
export const LayerToolbar: React.FC = () => {
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);
	const groupShapes = useWhiteboardStore((state) => state.groupShapes);

	const canGroup = selectedShapeIds.size >= 2;

	const handleGroup = () => {
		if (canGroup) {
			groupShapes();
		}
	};

	return (
		<div className="layer-toolbar">
			<button
				type="button"
				className="layer-toolbar__button"
				onClick={handleGroup}
				disabled={!canGroup}
				title="選択した形状をグループ化"
				aria-label="グループ化"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<title>グループ化</title>
					<rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
					<rect x="8" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
				</svg>
				<span>グループ化</span>
			</button>
		</div>
	);
};
