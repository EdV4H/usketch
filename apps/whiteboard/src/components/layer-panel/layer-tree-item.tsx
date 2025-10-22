import type { GroupShape, LayerTreeNode } from "@usketch/shared-types";
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

type DropPosition = "before" | "after" | "inside";

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
	const [dragOver, setDragOver] = useState<DropPosition | null>(null);
	const toggleShapeVisibility = useStore((state) => state.toggleShapeVisibility);
	const toggleGroupVisibility = useStore((state) => state.toggleGroupVisibility);
	const toggleShapeLock = useStore((state) => state.toggleShapeLock);
	const toggleGroupLock = useStore((state) => state.toggleGroupLock);
	const shapes = useStore((state) => state.shapes);
	const zOrder = useStore((state) => state.zOrder);
	const reorderLayers = useStore((state) => state.reorderLayers);
	const addToGroup = useStore((state) => state.addToGroup);
	const removeFromGroup = useStore((state) => state.removeFromGroup);

	const isGroup = node.type === "group";
	const id = isGroup ? node.group.id : node.shape.id;

	// Generate readable name for shapes
	const getShapeName = (): string => {
		if (isGroup) {
			return node.group.name;
		}

		// Use custom layer name if available
		if (node.shape.layer?.name) {
			return node.shape.layer.name;
		}

		// Generate readable name from ID
		// e.g., "red-rectangle" -> "Red Rectangle"
		const readableName = id
			.split("-")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");

		return readableName;
	};

	const name = getShapeName();
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
		if (isGroup) {
			toggleGroupVisibility(id);
		} else {
			toggleShapeVisibility(id);
		}
	};

	const handleToggleLock = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isGroup) {
			toggleGroupLock(id);
		} else {
			toggleShapeLock(id);
		}
	};

	// Drag & Drop handlers
	const handleDragStart = (e: React.DragEvent) => {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("application/usketch-layer", id);
		e.dataTransfer.setData("text/plain", id); // Fallback
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		e.dataTransfer.dropEffect = "move";

		// Calculate drop position based on mouse position
		const rect = e.currentTarget.getBoundingClientRect();
		const mouseY = e.clientY - rect.top;
		const height = rect.height;

		let position: DropPosition;
		if (isGroup && mouseY > height * 0.3 && mouseY < height * 0.7) {
			// Drop inside group (middle 40%)
			position = "inside";
		} else if (mouseY < height / 2) {
			// Drop before (top 50%)
			position = "before";
		} else {
			// Drop after (bottom 50%)
			position = "after";
		}

		setDragOver(position);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(null);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const draggedId =
			e.dataTransfer.getData("application/usketch-layer") || e.dataTransfer.getData("text/plain");
		if (!draggedId || draggedId === id) {
			setDragOver(null);
			return;
		}

		const draggedShape = shapes[draggedId];
		if (!draggedShape) {
			setDragOver(null);
			return;
		}

		const targetShape = shapes[id];
		if (!targetShape) {
			setDragOver(null);
			return;
		}

		// Handle different drop positions
		if (dragOver === "inside" && isGroup) {
			// Add to group
			const currentParentId = draggedShape.layer?.parentId;
			if (currentParentId) {
				removeFromGroup(currentParentId, [draggedId]);
			}
			addToGroup(id, [draggedId]);
		} else if (dragOver === "before" || dragOver === "after") {
			// Reorder in zOrder
			const newZOrder = [...zOrder];

			// Get the actual top-level parent IDs for both dragged and target
			const draggedTopLevelId = draggedShape.layer?.parentId || draggedId;
			const targetTopLevelId = targetShape.layer?.parentId || id;

			const draggedIndex = newZOrder.indexOf(draggedTopLevelId);
			const targetIndex = newZOrder.indexOf(targetTopLevelId);

			if (draggedIndex !== -1 && targetIndex !== -1) {
				// Only reorder if both are at top level or in same group
				if (draggedTopLevelId !== targetTopLevelId) {
					// Remove dragged item
					newZOrder.splice(draggedIndex, 1);

					// Calculate new insert position
					const adjustedTargetIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
					const insertIndex = dragOver === "before" ? adjustedTargetIndex : adjustedTargetIndex + 1;

					// Insert at new position
					newZOrder.splice(insertIndex, 0, draggedTopLevelId);

					reorderLayers(newZOrder);
				}
			} else if (draggedIndex === -1 && targetIndex !== -1) {
				// Dragged item is a child, need to remove from parent first
				const currentParentId = draggedShape.layer?.parentId;
				if (currentParentId) {
					removeFromGroup(currentParentId, [draggedId]);

					// Add to zOrder at the target position
					const insertIndex = dragOver === "before" ? targetIndex : targetIndex + 1;
					newZOrder.splice(insertIndex, 0, draggedId);

					reorderLayers(newZOrder);
				}
			}
		}

		setDragOver(null);
	};

	const indentStyle = {
		paddingLeft: `${depth * 20 + 8}px`,
	};

	return (
		<div className="layer-tree-item-wrapper">
			<div
				className={`layer-tree-item ${isSelected ? "selected" : ""} ${locked ? "locked" : ""} ${dragOver ? `drag-over-${dragOver}` : ""}`}
				style={indentStyle}
				onClick={handleSelect}
				onKeyDown={handleKeyDown}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
				draggable
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

						// Check if child is a GroupShape
						if (childShape.type === "group") {
							// Get the group data from shapes (it's a GroupShape now)
							const childGroupShape = childShape as GroupShape;
							const childGroup = {
								id: childGroupShape.id,
								name: childGroupShape.name,
								childIds: childGroupShape.childIds,
								visible: childGroupShape.layer?.visible ?? true,
								locked: childGroupShape.layer?.locked ?? false,
								collapsed: childGroupShape.collapsed,
								zIndex: childGroupShape.layer?.zIndex ?? 0,
								...(childGroupShape.layer?.parentId
									? { parentId: childGroupShape.layer.parentId }
									: {}),
							};

							const childNode: LayerTreeNode = {
								type: "group",
								group: childGroup,
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
						}

						// Regular shape
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
