import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useMemo } from "react";
import { LayerToolbar } from "./layer-toolbar";
import { LayerTree } from "./layer-tree";
import "./layer-panel.css";

/**
 * レイヤーパネルメインコンポーネント
 * レイヤーツリーの表示・管理を行う
 */
export const LayerPanel: React.FC = () => {
	const layerPanelOpen = useWhiteboardStore((state) => state.layerPanelOpen);
	const toggleLayerPanel = useWhiteboardStore((state) => state.toggleLayerPanel);

	// getLayerTreeは毎回新しい配列を返すため、依存する状態を直接購読してメモ化
	const shapes = useWhiteboardStore((state) => state.shapes);
	const groups = useWhiteboardStore((state) => state.groups);
	const zOrder = useWhiteboardStore((state) => state.zOrder);
	const getLayerTreeFn = useWhiteboardStore((state) => state.getLayerTree);

	// biome-ignore lint/correctness/useExhaustiveDependencies: getLayerTreeFn内部でshapes/groups/zOrderを参照するため必要
	const layerTree = useMemo(() => getLayerTreeFn(), [getLayerTreeFn, shapes, groups, zOrder]);

	if (!layerPanelOpen) {
		return (
			<div className="layer-panel layer-panel--collapsed">
				<button
					type="button"
					className="layer-panel__toggle"
					onClick={toggleLayerPanel}
					aria-label="レイヤーパネルを開く"
					title="レイヤーパネルを開く"
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>レイヤー</title>
						<path
							d="M10 4L2 8L10 12L18 8L10 4Z"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
						<path
							d="M2 12L10 16L18 12"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			</div>
		);
	}

	return (
		<div className="layer-panel">
			<div className="layer-panel__header">
				<h3>レイヤー</h3>
				<div className="layer-panel__header-actions">
					<button
						type="button"
						className="icon-button"
						onClick={toggleLayerPanel}
						aria-label="レイヤーパネルを閉じる"
						title="レイヤーパネルを閉じる"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 16 16"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>閉じる</title>
							<path
								d="M12 4L4 12M4 4L12 12"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>
			</div>

			<div className="layer-panel__toolbar">
				<LayerToolbar />
			</div>

			<div className="layer-panel__content">
				<LayerTree nodes={layerTree} />
			</div>
		</div>
	);
};
