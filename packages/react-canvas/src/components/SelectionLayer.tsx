import type React from "react";
import { useMemo } from "react";
import type { SelectionLayerProps } from "../types";

export const SelectionLayer: React.FC<SelectionLayerProps> = ({
	selectedIds,
	shapes,
	camera,
	className = "",
}) => {
	const selectedShapes = useMemo(() => {
		return Array.from(selectedIds)
			.map((id) => shapes[id])
			.filter(Boolean);
	}, [selectedIds, shapes]);

	const boundingBox = useMemo(() => {
		if (selectedShapes.length === 0) return null;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		selectedShapes.forEach((shape) => {
			const width = "width" in shape ? shape.width : 100;
			const height = "height" in shape ? shape.height : 100;
			minX = Math.min(minX, shape.x);
			minY = Math.min(minY, shape.y);
			maxX = Math.max(maxX, shape.x + width);
			maxY = Math.max(maxY, shape.y + height);
		});

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}, [selectedShapes]);

	if (!boundingBox) return null;

	const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

	return (
		<div
			className={`selection-layer ${className}`.trim()}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				transform,
				transformOrigin: "0 0",
			}}
		>
			<div
				className="selection-box"
				style={{
					position: "absolute",
					left: boundingBox.x - 2,
					top: boundingBox.y - 2,
					width: boundingBox.width + 4,
					height: boundingBox.height + 4,
					border: "2px solid #0066ff",
					backgroundColor: "rgba(0, 102, 255, 0.1)",
					pointerEvents: "none",
				}}
			/>
		</div>
	);
};
