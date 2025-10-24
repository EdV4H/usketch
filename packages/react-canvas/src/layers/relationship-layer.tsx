/**
 * Relationship Visualization Layer
 *
 * 親子関係を視覚的に表示するレイヤー
 */

import type { Camera, Shape } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useMemo } from "react";

interface RelationshipLayerProps {
	shapes: Record<string, Shape>;
	camera: Camera;
	showRelationships?: boolean;
}

/**
 * 親子関係を線で表示
 */
export const RelationshipLayer: React.FC<RelationshipLayerProps> = ({
	shapes,
	camera,
	showRelationships = false,
}) => {
	const relationships = useWhiteboardStore((state) => state.relationships);

	// 親子関係の線を描画するためのデータを計算
	const relationshipLines = useMemo(() => {
		if (!showRelationships || relationships.length === 0) return [];

		return relationships
			.map((rel) => {
				const parent = shapes[rel.parentId];
				const child = shapes[rel.childId];

				if (!parent || !child) return null;

				// 親と子の中心座標を計算
				const parentCenterX = "width" in parent ? parent.x + parent.width / 2 : parent.x;
				const parentCenterY = "height" in parent ? parent.y + parent.height / 2 : parent.y;

				const childCenterX = "width" in child ? child.x + child.width / 2 : child.x;
				const childCenterY = "height" in child ? child.y + child.height / 2 : child.y;

				// カメラ座標に変換
				const x1 = parentCenterX * camera.zoom + camera.x;
				const y1 = parentCenterY * camera.zoom + camera.y;
				const x2 = childCenterX * camera.zoom + camera.x;
				const y2 = childCenterY * camera.zoom + camera.y;

				// 関係タイプに応じた色を設定
				let color = "#999";
				let strokeWidth = 1;
				let strokeDasharray = "none";

				switch (rel.type) {
					case "containment":
						color = "#4CAF50";
						strokeWidth = 2;
						break;
					case "attachment":
						color = "#2196F3";
						strokeWidth = 1.5;
						strokeDasharray = "4 2";
						break;
					case "connection":
						color = "#FF9800";
						strokeWidth = 1.5;
						break;
					case "clip":
					case "mask":
						color = "#9C27B0";
						strokeWidth = 1;
						strokeDasharray = "2 2";
						break;
					default:
						break;
				}

				return {
					id: rel.id,
					x1,
					y1,
					x2,
					y2,
					color,
					strokeWidth,
					strokeDasharray,
					type: rel.type,
				};
			})
			.filter((line) => line !== null);
	}, [relationships, shapes, camera, showRelationships]);

	if (!showRelationships || relationshipLines.length === 0) {
		return null;
	}

	return (
		<svg
			aria-label="Shape relationships visualization"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 5,
			}}
		>
			<title>Shape relationships visualization</title>
			{relationshipLines.map((line) => (
				<g key={line.id}>
					{/* 親子関係の線 */}
					<line
						x1={line.x1}
						y1={line.y1}
						x2={line.x2}
						y2={line.y2}
						stroke={line.color}
						strokeWidth={line.strokeWidth}
						strokeDasharray={line.strokeDasharray}
						opacity={0.6}
					/>
					{/* 親側のマーカー（円） */}
					<circle cx={line.x1} cy={line.y1} r={4} fill={line.color} opacity={0.8} />
					{/* 子側のマーカー（矢印風の三角形） */}
					<circle cx={line.x2} cy={line.y2} r={3} fill={line.color} opacity={0.8} />
				</g>
			))}
		</svg>
	);
};
