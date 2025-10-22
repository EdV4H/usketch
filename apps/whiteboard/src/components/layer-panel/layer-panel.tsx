import type { LayerTreeNode } from "@usketch/shared-types";
import { DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import type React from "react";
import { useMemo } from "react";
import { useStore } from "../../hooks/use-store";
import { LayerTreeItem } from "./layer-tree-item";
import "./layer-panel.css";

/**
 * Layer Panel Component
 *
 * Displays the layer tree with groups and shapes.
 * Supports:
 * - Visibility toggle
 * - Lock toggle
 * - Selection
 * - Z-order manipulation
 */
export const LayerPanel: React.FC = () => {
	const shapes = useStore((state) => state.shapes);
	const getGroups = useStore((state) => state.getGroups);
	const zOrder = useStore((state) => state.zOrder);
	const selectedLayerId = useStore((state) => state.selectedLayerId);
	const setSelectedLayerId = useStore((state) => state.setSelectedLayerId);

	// Compute layer tree with useMemo to avoid infinite loops
	const layerTree = useMemo<LayerTreeNode[]>(() => {
		const tree: LayerTreeNode[] = [];
		const groups = getGroups();

		// Build tree in zOrder (back to front)
		// Only show top-level items (items without parentId)
		for (const id of zOrder) {
			const shape = shapes[id];
			if (!shape) continue;

			// Skip shapes that have a parent (they will be shown under their parent)
			if (shape.layer?.parentId) continue;

			// Check if it's a GroupShape
			if (shape.type === "group") {
				// Convert GroupShape to ShapeGroup for backward compatibility
				const group = groups[id];
				if (group) {
					tree.push({ type: "group", group });
				}
			} else {
				// It's a regular shape
				const metadata = shape.layer || DEFAULT_LAYER_METADATA;
				tree.push({ type: "shape", shape, metadata });
			}
		}

		return tree;
	}, [shapes, getGroups, zOrder]);

	return (
		<div className="layer-panel">
			<div className="layer-panel-content">
				{layerTree.length === 0 ? (
					<div className="layer-panel-empty">No layers</div>
				) : (
					<div className="layer-tree">
						{layerTree.map((node: LayerTreeNode) => (
							<LayerTreeItem
								key={node.type === "group" ? node.group.id : node.shape.id}
								node={node}
								depth={0}
								selectedId={selectedLayerId}
								onSelect={setSelectedLayerId}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
};
