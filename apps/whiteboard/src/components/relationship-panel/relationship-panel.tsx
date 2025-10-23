/**
 * Relationship Panel Component
 *
 * 親子関係を表示・管理するパネル
 */

import type { RelationshipEffect, ShapeRelationship } from "@usketch/shared-types";
import type React from "react";
import { useStore } from "../../hooks/use-store";
import "./relationship-panel.css";

export const RelationshipPanel: React.FC = () => {
	const relationships = useStore((state) => state.relationships);
	const shapes = useStore((state) => state.shapes);
	const removeRelationship = useStore((state) => state.removeRelationship);

	// 関係タイプの日本語名
	const relationshipTypeNames: Record<string, string> = {
		containment: "包含",
		attachment: "付随",
		connection: "接続",
		clip: "クリップ",
		mask: "マスク",
		instance: "インスタンス",
		layout: "レイアウト",
	};

	// 関係タイプの色
	const relationshipTypeColors: Record<string, string> = {
		containment: "#4CAF50",
		attachment: "#2196F3",
		connection: "#FF9800",
		clip: "#9C27B0",
		mask: "#9C27B0",
		instance: "#F44336",
		layout: "#00BCD4",
	};

	const handleDeleteRelationship = (relationshipId: string) => {
		if (confirm("この関係を削除しますか？")) {
			removeRelationship(relationshipId);
		}
	};

	return (
		<div className="relationship-panel">
			<div className="relationship-panel__header">
				<h3 className="relationship-panel__title">親子関係</h3>
				<div className="relationship-panel__count">{relationships.length}件</div>
			</div>

			{relationships.length === 0 ? (
				<div className="relationship-panel__empty">
					<p>親子関係が設定されていません</p>
					<small>
						図形を重ねると自動的に関係が形成される場合があります。
						<br />
						デバッグパネルの「Run Relationship Demo」でデモを試せます。
					</small>
				</div>
			) : (
				<div className="relationship-panel__list">
					{relationships.map((rel: ShapeRelationship) => {
						const parent = shapes[rel.parentId];
						const child = shapes[rel.childId];
						const typeName = relationshipTypeNames[rel.type] || rel.type;
						const typeColor = relationshipTypeColors[rel.type] || "#999";

						return (
							<div key={rel.id} className="relationship-item">
								<div className="relationship-item__header">
									<span className="relationship-item__type" style={{ backgroundColor: typeColor }}>
										{typeName}
									</span>
									<button
										type="button"
										className="relationship-item__delete"
										onClick={() => handleDeleteRelationship(rel.id)}
										title="関係を削除"
									>
										×
									</button>
								</div>

								<div className="relationship-item__connection">
									<div className="relationship-item__shape">
										<span className="relationship-item__label">親:</span>
										<span className="relationship-item__shape-name">
											{parent?.type || "不明"} ({rel.parentId.slice(0, 8)}...)
										</span>
									</div>
									<div className="relationship-item__arrow">↓</div>
									<div className="relationship-item__shape">
										<span className="relationship-item__label">子:</span>
										<span className="relationship-item__shape-name">
											{child?.type || "不明"} ({rel.childId.slice(0, 8)}...)
										</span>
									</div>
								</div>

								{rel.effects && rel.effects.length > 0 && (
									<div className="relationship-item__effects">
										<div className="relationship-item__effects-title">エフェクト:</div>
										<ul className="relationship-item__effects-list">
											{rel.effects.map((effect: RelationshipEffect, idx: number) => (
												<li key={idx}>
													{effect.type === "move-with-parent" && "親と一緒に移動"}
													{effect.type === "rotate-with-parent" && "親と一緒に回転"}
													{effect.type === "resize-with-parent" && "親と一緒にリサイズ"}
													{effect.type === "clip-by-parent" && "親でクリップ"}
													{effect.type === "inherit-style" && "スタイル継承"}
													{effect.type === "maintain-distance" && "距離を維持"}
													{effect.type === "auto-layout" && "自動レイアウト"}
												</li>
											))}
										</ul>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			<div className="relationship-panel__footer">
				<small>親図形を移動・変形すると、設定されたエフェクトに応じて子図形も追従します。</small>
			</div>
		</div>
	);
};
