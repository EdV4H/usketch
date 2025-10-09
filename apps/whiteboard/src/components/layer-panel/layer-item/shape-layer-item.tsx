import type { LayerMetadata, Shape } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useState } from "react";
import { LayerThumbnail } from "../layer-thumbnail";
import "./layer-item.css";

interface ShapeLayerItemProps {
	shape: Shape;
	metadata: LayerMetadata;
	level: number;
}

/**
 * 形状レイヤー項目コンポーネント
 * 個別の形状をレイヤーパネルに表示
 */
export const ShapeLayerItem: React.FC<ShapeLayerItemProps> = ({ shape, metadata, level }) => {
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);
	const selectShape = useWhiteboardStore((state) => state.selectShape);
	const clearSelection = useWhiteboardStore((state) => state.clearSelection);
	const toggleShapeVisibility = useWhiteboardStore((state) => state.toggleShapeVisibility);
	const toggleShapeLock = useWhiteboardStore((state) => state.toggleShapeLock);
	const getLayerName = useWhiteboardStore((state) => state.getLayerName);
	const zOrder = useWhiteboardStore((state) => state.zOrder);
	const reorderLayers = useWhiteboardStore((state) => state.reorderLayers);

	const [isDragging, setIsDragging] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);

	const isSelected = selectedShapeIds.has(shape.id);
	const layerName = getLayerName(shape.id);

	const handleClick = (e: React.MouseEvent) => {
		// Don't select locked or invisible shapes
		if (metadata.locked || !metadata.visible) return;

		if (e.metaKey || e.ctrlKey) {
			// 複数選択
			selectShape(shape.id);
		} else {
			clearSelection();
			selectShape(shape.id);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleClick(e as unknown as React.MouseEvent);
		}
	};

	// Drag and drop handlers
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("application/layer-item", shape.id);
		setIsDragging(true);
	};

	const handleDragEnd = () => {
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setIsDragOver(true);
	};

	const handleDragLeave = () => {
		setIsDragOver(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);

		const draggedId = e.dataTransfer.getData("application/layer-item");
		if (draggedId && draggedId !== shape.id && zOrder) {
			// Create new order: place dragged item before this item
			const newOrder = zOrder.filter((id) => id !== draggedId);
			const targetIndex = newOrder.indexOf(shape.id);

			if (targetIndex !== -1) {
				// Insert dragged item before target
				newOrder.splice(targetIndex, 0, draggedId);
				reorderLayers(newOrder);
			}
		}
	};

	return (
		<div
			role="button"
			tabIndex={metadata.locked ? -1 : 0}
			className={`layer-item ${isSelected ? "layer-item--selected" : ""} ${
				metadata.locked ? "layer-item--locked" : ""
			} ${!metadata.visible ? "layer-item--hidden" : ""} ${isDragging ? "layer-item--dragging" : ""} ${
				isDragOver ? "layer-item--drag-over" : ""
			}`}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			draggable={!metadata.locked}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			style={{ paddingLeft: `${level * 20 + 8}px` }}
			data-testid={`layer-item-${shape.id}`}
			aria-label={`${layerName}を選択`}
		>
			<LayerThumbnail shape={shape} />

			<span className="layer-item__name" title={layerName}>
				{layerName}
			</span>

			<div className="layer-item__controls">
				<button
					type="button"
					className="icon-button icon-button--sm"
					onClick={(e) => {
						e.stopPropagation();
						toggleShapeVisibility(shape.id);
					}}
					aria-label={metadata.visible ? "非表示" : "表示"}
					title={metadata.visible ? "非表示" : "表示"}
				>
					{metadata.visible ? (
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>表示</title>
							<path
								d="M1 8C1 8 3 3 8 3C13 3 15 8 15 8C15 8 13 13 8 13C3 13 1 8 1 8Z"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
							<circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
						</svg>
					) : (
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>非表示</title>
							<path
								d="M6.5 3.5C7 3.3 7.5 3 8 3C13 3 15 8 15 8C15 8 14.5 9 13.5 10M11 11C10 11.7 9 12 8 12C3 12 1 8 1 8C1 8 2 6 4 4.5"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
							<path d="M1 1L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
						</svg>
					)}
				</button>

				<button
					type="button"
					className="icon-button icon-button--sm"
					onClick={(e) => {
						e.stopPropagation();
						toggleShapeLock(shape.id);
					}}
					aria-label={metadata.locked ? "ロック解除" : "ロック"}
					title={metadata.locked ? "ロック解除" : "ロック"}
				>
					{metadata.locked ? (
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>ロック</title>
							<rect
								x="3"
								y="7"
								width="10"
								height="7"
								rx="1"
								stroke="currentColor"
								strokeWidth="1.5"
							/>
							<path
								d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V7"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					) : (
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>ロック解除</title>
							<rect
								x="3"
								y="7"
								width="10"
								height="7"
								rx="1"
								stroke="currentColor"
								strokeWidth="1.5"
							/>
							<path
								d="M5 7V5C5 3.3 6.3 2 8 2C9.7 2 11 3.3 11 5V6"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
							/>
						</svg>
					)}
				</button>
			</div>
		</div>
	);
};
