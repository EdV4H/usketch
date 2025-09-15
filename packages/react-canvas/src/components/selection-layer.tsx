import { globalShapeRegistry as ShapeRegistry } from "@usketch/shape-registry";
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
			// Try to get bounds from plugin, fall back to shape dimensions
			const plugin = ShapeRegistry.getPlugin(shape.type);
			let bounds = {
				x: shape.x,
				y: shape.y,
				width: "width" in shape ? shape.width : 100,
				height: "height" in shape ? shape.height : 100,
			};

			if (plugin?.getBounds) {
				bounds = plugin.getBounds(shape);
			}

			minX = Math.min(minX, bounds.x);
			minY = Math.min(minY, bounds.y);
			maxX = Math.max(maxX, bounds.x + bounds.width);
			maxY = Math.max(maxY, bounds.y + bounds.height);
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
			{/* Show group bounding box for multiple selection */}
			{selectedShapes.length > 1 ? (
				<div
					className="selection-box group-selection"
					data-testid="group-selection-box"
					style={{
						position: "absolute",
						left: boundingBox.x - 2,
						top: boundingBox.y - 2,
						width: boundingBox.width + 4,
						height: boundingBox.height + 4,
						border: "2px solid #0066ff",
						backgroundColor: "rgba(0, 102, 255, 0.05)",
						pointerEvents: "none",
					}}
				/>
			) : (
				/* Show individual selection boxes */
				selectedShapes.map((shape) => {
					// Try to get bounds from plugin, fall back to shape dimensions
					const plugin = ShapeRegistry.getPlugin(shape.type);
					let bounds = {
						x: shape.x,
						y: shape.y,
						width: "width" in shape ? shape.width : 100,
						height: "height" in shape ? shape.height : 100,
					};

					if (plugin?.getBounds) {
						bounds = plugin.getBounds(shape);
					}

					return (
						<div
							key={shape.id}
							className="selection-box"
							data-testid={`selection-box-${shape.id}`}
							style={{
								position: "absolute",
								left: bounds.x - 2,
								top: bounds.y - 2,
								width: bounds.width + 4,
								height: bounds.height + 4,
								border: "2px solid #0066ff",
								backgroundColor: "rgba(0, 102, 255, 0.1)",
								pointerEvents: "none",
							}}
						/>
					);
				})
			)}
			{/* Show resize handles for single selection */}
			{selectedShapes.length === 1 && (
				<>
					{/* Corner handles with larger interaction area */}
					<div
						className="resize-handle nw"
						data-resize-handle="nw"
						data-testid="resize-handle-nw"
						style={{
							position: "absolute",
							left: boundingBox.x - 10,
							top: boundingBox.y - 10,
							width: 20,
							height: 20,
							cursor: "nw-resize",
							pointerEvents: "auto",
							zIndex: 10,
							// Invisible expanded hit area
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						{/* Visible handle */}
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
					<div
						className="resize-handle ne"
						data-resize-handle="ne"
						data-testid="resize-handle-ne"
						style={{
							position: "absolute",
							left: boundingBox.x + boundingBox.width - 10,
							top: boundingBox.y - 10,
							width: 20,
							height: 20,
							cursor: "ne-resize",
							pointerEvents: "auto",
							zIndex: 10,
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
					<div
						className="resize-handle sw"
						data-resize-handle="sw"
						data-testid="resize-handle-sw"
						style={{
							position: "absolute",
							left: boundingBox.x - 10,
							top: boundingBox.y + boundingBox.height - 10,
							width: 20,
							height: 20,
							cursor: "sw-resize",
							pointerEvents: "auto",
							zIndex: 10,
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
					<div
						className="resize-handle se"
						data-resize-handle="se"
						data-testid="resize-handle-se"
						style={{
							position: "absolute",
							left: boundingBox.x + boundingBox.width - 10,
							top: boundingBox.y + boundingBox.height - 10,
							width: 20,
							height: 20,
							cursor: "se-resize",
							pointerEvents: "auto",
							zIndex: 10,
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
				</>
			)}
		</div>
	);
};
