import type { LayerTreeNode } from "@usketch/shared-types";
import type React from "react";
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
		</div>
	);
};
