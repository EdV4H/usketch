import type { LayerTreeNode } from "@usketch/shared-types";
import type React from "react";
import { useState } from "react";
import { useStore } from "../../hooks/use-store";
import "./layer-tree-item.css";

interface LayerTreeItemProps {
	node: LayerTreeNode;
	depth: number;
	selectedId: string | null;
	onSelect: (id: string | null) => void;
}

/**
 * Layer Tree Item Component
 *
 * Represents a single item in the layer tree (shape or group).
 * Supports:
 * - Expand/collapse for groups
 * - Visibility toggle
 * - Lock toggle
 * - Selection
 */
export const LayerTreeItem: React.FC<LayerTreeItemProps> = ({
	node,
	depth,
	selectedId,
	onSelect,
}) => {
	const [isExpanded, setIsExpanded] = useState(true);
	const toggleShapeVisibility = useStore((state) => state.toggleShapeVisibility);
	const toggleShapeLock = useStore((state) => state.toggleShapeLock);
	const shapes = useStore((state) => state.shapes);

	const isGroup = node.type === "group";
	const id = isGroup ? node.group.id : node.shape.id;
	const name = isGroup ? node.group.name : `Shape ${id.substring(0, 8)}`;
	const visible = isGroup ? node.group.visible : node.metadata.visible;
	const locked = isGroup ? node.group.locked : node.metadata.locked;
	const isSelected = selectedId === id;

	const handleToggleExpand = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsExpanded(!isExpanded);
	};

	const handleSelect = () => {
		onSelect(isSelected ? null : id);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleSelect();
		}
	};

	const handleToggleVisibility = (e: React.MouseEvent) => {
		e.stopPropagation();
		toggleShapeVisibility(id);
	};

	const handleToggleLock = (e: React.MouseEvent) => {
		e.stopPropagation();
		toggleShapeLock(id);
	};

	const indentStyle = {
		paddingLeft: `${depth * 20 + 8}px`,
	};

	return (
		<div className="layer-tree-item-wrapper">
			<div
				className={`layer-tree-item ${isSelected ? "selected" : ""} ${locked ? "locked" : ""}`}
				style={indentStyle}
				onClick={handleSelect}
				onKeyDown={handleKeyDown}
				role="button"
				tabIndex={0}
				data-layer-id={id}
				data-layer-type={node.type}
			>
				{isGroup && (
					<button
						type="button"
						className="layer-tree-item-expand"
						onClick={handleToggleExpand}
						aria-label={isExpanded ? "Collapse group" : "Expand group"}
					>
						{isExpanded ? "▼" : "▶"}
					</button>
				)}

				<span className="layer-tree-item-icon">{isGroup ? "📁" : "□"}</span>

				<span className="layer-tree-item-name">{name}</span>

				<div className="layer-tree-item-controls">
					<button
						type="button"
						className={`layer-tree-item-visibility ${visible ? "visible" : "hidden"}`}
						onClick={handleToggleVisibility}
						aria-label={visible ? "Hide layer" : "Show layer"}
					>
						{visible ? "👁" : "👁‍🗨"}
					</button>

					<button
						type="button"
						className={`layer-tree-item-lock ${locked ? "locked" : "unlocked"}`}
						onClick={handleToggleLock}
						aria-label={locked ? "Unlock layer" : "Lock layer"}
					>
						{locked ? "🔒" : "🔓"}
					</button>
				</div>
			</div>

			{isGroup && isExpanded && (
				<div className="layer-tree-item-children">
					{node.group.childIds.map((childId) => {
						const childShape = shapes[childId];
						if (!childShape) return null;

						const childNode: LayerTreeNode = {
							type: "shape",
							shape: childShape,
							metadata: childShape.layer || {
								visible: true,
								locked: false,
								zIndex: 0,
							},
						};

						return (
							<LayerTreeItem
								key={childId}
								node={childNode}
								depth={depth + 1}
								selectedId={selectedId}
								onSelect={onSelect}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
};
