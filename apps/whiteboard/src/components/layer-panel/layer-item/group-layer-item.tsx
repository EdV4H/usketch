import type { ShapeGroup } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useState } from "react";
import { LayerTree } from "../layer-tree";
import "./layer-item.css";

interface GroupLayerItemProps {
	group: ShapeGroup;
	level: number;
}

/**
 * グループレイヤー項目コンポーネント
 * グループ化された形状をレイヤーパネルに表示
 */
export const GroupLayerItem: React.FC<GroupLayerItemProps> = ({ group, level }) => {
	const [isExpanded, setIsExpanded] = useState(!group.collapsed);
	const shapes = useWhiteboardStore((state) => state.shapes);
	const toggleGroupVisibility = useWhiteboardStore((state) => state.toggleGroupVisibility);
	const toggleGroupLock = useWhiteboardStore((state) => state.toggleGroupLock);

	// グループ内の形状からレイヤーツリーノードを生成
	const childNodes = group.childIds
		.map((id) => {
			const shape = shapes[id];
			if (!shape) return null;
			return {
				type: "shape" as const,
				shape,
				metadata: shape.layer || {
					visible: true,
					locked: false,
					zIndex: 0,
				},
			};
		})
		.filter((node) => node !== null);

	const handleToggleExpand = (e: React.MouseEvent) => {
		e.stopPropagation();
		setIsExpanded(!isExpanded);
	};

	return (
		<div className="layer-item layer-item--group" data-testid={`layer-group-${group.id}`}>
			<div
				className={`layer-item__header ${!group.visible ? "layer-item--hidden" : ""} ${
					group.locked ? "layer-item--locked" : ""
				}`}
				style={{ paddingLeft: `${level * 20 + 8}px` }}
			>
				<button
					type="button"
					className="layer-item__expand-button"
					onClick={handleToggleExpand}
					aria-label={isExpanded ? "折りたたむ" : "展開する"}
					aria-expanded={isExpanded}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
						style={{
							transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
							transition: "transform 0.2s",
						}}
					>
						<title>{isExpanded ? "折りたたむ" : "展開"}</title>
						<path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
					</svg>
				</button>

				<svg
					width="16"
					height="16"
					viewBox="0 0 16 16"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					className="layer-item__icon"
				>
					<title>グループ</title>
					<rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
					<rect x="8" y="8" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
				</svg>

				<span className="layer-item__name" title={group.name}>
					{group.name}
				</span>

				<span className="layer-item__count">({group.childIds.length})</span>

				<div className="layer-item__controls">
					<button
						type="button"
						className="icon-button icon-button--sm"
						onClick={(e) => {
							e.stopPropagation();
							toggleGroupVisibility(group.id);
						}}
						aria-label={group.visible ? "非表示" : "表示"}
						title={group.visible ? "非表示" : "表示"}
					>
						{group.visible ? (
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
								<path
									d="M1 1L15 15"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeLinecap="round"
								/>
							</svg>
						)}
					</button>

					<button
						type="button"
						className="icon-button icon-button--sm"
						onClick={(e) => {
							e.stopPropagation();
							toggleGroupLock(group.id);
						}}
						aria-label={group.locked ? "ロック解除" : "ロック"}
						title={group.locked ? "ロック解除" : "ロック"}
					>
						{group.locked ? (
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

			{isExpanded && childNodes.length > 0 && (
				<div className="layer-item__children">
					<LayerTree nodes={childNodes} level={level + 1} />
				</div>
			)}
		</div>
	);
};
