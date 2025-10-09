import type { LayerTreeNode } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useState } from "react";
import { GroupLayerItem } from "./layer-item/group-layer-item";
import { ShapeLayerItem } from "./layer-item/shape-layer-item";
import "./layer-tree.css";

interface LayerTreeProps {
	nodes: LayerTreeNode[];
	level?: number;
}

/**
 * レイヤーツリーコンポーネント
 * 階層構造でレイヤーを表示
 */
export const LayerTree: React.FC<LayerTreeProps> = ({ nodes, level = 0 }) => {
	const zOrder = useWhiteboardStore((state) => state.zOrder);
	const reorderLayers = useWhiteboardStore((state) => state.reorderLayers);
	const [isDragOver, setIsDragOver] = useState(false);

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
		if (draggedId && zOrder) {
			// Move to the beginning of zOrder (bottom of layer list = back)
			const newOrder = zOrder.filter((id) => id !== draggedId);
			newOrder.unshift(draggedId); // Add to beginning = back
			reorderLayers(newOrder);
		}
	};

	if (nodes.length === 0) {
		return (
			<div className="layer-tree layer-tree--empty">
				<p>レイヤーがありません</p>
			</div>
		);
	}

	return (
		<div className="layer-tree">
			{nodes.map((node) => {
				if (node.type === "group") {
					return <GroupLayerItem key={node.group.id} group={node.group} level={level} />;
				}
				return (
					<ShapeLayerItem
						key={node.shape.id}
						shape={node.shape}
						metadata={node.metadata}
						level={level}
					/>
				);
			})}
			{/* Drop zone at the bottom (to move to back) */}
			<div
				role="button"
				tabIndex={-1}
				className={`layer-tree__drop-zone ${isDragOver ? "layer-tree__drop-zone--active" : ""}`}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				aria-label="最背面に移動"
			>
				<div className="layer-tree__drop-indicator">最背面に移動</div>
			</div>
		</div>
	);
};
