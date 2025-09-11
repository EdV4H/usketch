import type React from "react";
import type { SelectionIndicatorProps } from "../types";

export const DefaultSelectionIndicator: React.FC<SelectionIndicatorProps> = ({
	bounds,
	visible,
	camera,
	selectedCount,
}) => {
	if (!visible || !bounds) {
		return null;
	}

	// カメラ変換を適用
	const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

	return (
		<div
			data-testid="selection-indicator"
			style={{
				position: "absolute",
				left: bounds.x,
				top: bounds.y,
				width: bounds.width,
				height: bounds.height,
				border: "1px dashed #007bff",
				backgroundColor: "rgba(0, 123, 255, 0.1)",
				pointerEvents: "none",
				zIndex: 1000,
				transform,
				transformOrigin: "0 0",
			}}
		>
			{/* オプション: 選択数の表示 */}
			{selectedCount !== undefined && selectedCount > 0 && (
				<div
					style={{
						position: "absolute",
						bottom: -20,
						right: 0,
						fontSize: "11px",
						color: "#007bff",
						backgroundColor: "white",
						padding: "2px 6px",
						borderRadius: "3px",
						border: "1px solid #007bff",
					}}
				>
					{selectedCount} item{selectedCount !== 1 ? "s" : ""}
				</div>
			)}
		</div>
	);
};
