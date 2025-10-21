import type { LayerTreeNode } from "@usketch/shared-types";
import type React from "react";
import { useState } from "react";
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
	const [collapsed, setCollapsed] = useState(false);
	const layerTree = useStore((state) => state.getLayerTree());
	const selectedLayerId = useStore((state) => state.selectedLayerId);
	const setSelectedLayerId = useStore((state) => state.setSelectedLayerId);

	const handleTogglePanel = () => {
		setCollapsed(!collapsed);
	};

	if (collapsed) {
		return (
			<div className="layer-panel collapsed">
				<button
					type="button"
					className="layer-panel-toggle"
					onClick={handleTogglePanel}
					aria-label="Expand layer panel"
				>
					▶
				</button>
			</div>
		);
	}

	return (
		<div className="layer-panel">
			<div className="layer-panel-header">
				<h3 className="layer-panel-title">Layers</h3>
				<button
					type="button"
					className="layer-panel-toggle"
					onClick={handleTogglePanel}
					aria-label="Collapse layer panel"
				>
					◀
				</button>
			</div>

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
