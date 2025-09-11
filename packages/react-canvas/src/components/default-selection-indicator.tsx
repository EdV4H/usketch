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

	// boundsはワールド座標なので、スクリーン座標に変換
	const screenX = bounds.x * camera.zoom + camera.x;
	const screenY = bounds.y * camera.zoom + camera.y;
	const screenWidth = bounds.width * camera.zoom;
	const screenHeight = bounds.height * camera.zoom;

	return (
		<div
			data-testid="selection-indicator"
			style={{
				position: "absolute",
				left: screenX,
				top: screenY,
				width: screenWidth,
				height: screenHeight,
				border: "1px dashed #007bff",
				backgroundColor: "rgba(0, 123, 255, 0.1)",
				pointerEvents: "none",
				zIndex: 1000,
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
