import type { StyleProperties } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useEffect, useState } from "react";
import { ColorPicker } from "./controls/color-picker";
import { OpacitySlider } from "./controls/opacity-slider";
import { ShadowSettings } from "./controls/shadow-settings";
import { StrokeWidthSlider } from "./controls/stroke-width-slider";
import { StyleActions } from "./controls/style-actions";
import { StylePresets } from "./controls/style-presets";
import "./property-panel.css";

/**
 * Property Panel Content
 *
 * Displays style properties for selected shapes.
 * This is the pure content component without positioning/layout concerns.
 */
export const PropertyPanelContent: React.FC = () => {
	const selectedShapeIds = useWhiteboardStore((state) => state.selectedShapeIds);
	const selectedShapeStyles = useWhiteboardStore((state) => state.selectedShapeStyles);
	const updateSelectedShapesStyle = useWhiteboardStore((state) => state.updateSelectedShapesStyle);

	// パネルの開閉状態
	const [isCollapsed, setIsCollapsed] = useState(false);

	// 選択変更時にスタイルを更新
	const updateSelectedShapeStyles = useWhiteboardStore((state) => state.updateSelectedShapeStyles);

	useEffect(() => {
		updateSelectedShapeStyles();
	}, [updateSelectedShapeStyles]);

	// 選択中の形状がない場合
	if (selectedShapeIds.size === 0) {
		return (
			<div className="property-panel__empty-state">
				<p>形状を選択してください</p>
			</div>
		);
	}

	const handleStyleChange = (styles: Partial<StyleProperties>) => {
		updateSelectedShapesStyle(styles);
	};

	return (
		<>
			<div className="property-panel__header">
				<h3>プロパティ</h3>
				<div className="property-panel__header-actions">
					<span className="selected-count">{selectedShapeIds.size}個選択中</span>
					<button
						type="button"
						className="collapse-button"
						onClick={() => setIsCollapsed(!isCollapsed)}
						aria-label={isCollapsed ? "展開" : "折りたたみ"}
					>
						{isCollapsed ? "▶" : "▼"}
					</button>
				</div>
			</div>

			{!isCollapsed && (
				<div className="property-panel__content">
					{/* 外観設定セクション */}
					<section className="property-section">
						<h4 className="property-section__title">外観</h4>

						<div className="property-control">
							<ColorPicker
								label="塗りつぶし"
								color={selectedShapeStyles?.fillColor || "#e0e0ff"}
								onChange={(color) => handleStyleChange({ fillColor: color })}
							/>
						</div>

						<div className="property-control">
							<ColorPicker
								label="線の色"
								color={selectedShapeStyles?.strokeColor || "#333333"}
								onChange={(color) => handleStyleChange({ strokeColor: color })}
							/>
						</div>
					</section>

					{/* 線設定セクション */}
					<section className="property-section">
						<h4 className="property-section__title">線</h4>

						<div className="property-control">
							<StrokeWidthSlider
								value={selectedShapeStyles?.strokeWidth || 2}
								onChange={(width) => handleStyleChange({ strokeWidth: width })}
							/>
						</div>
					</section>

					{/* エフェクトセクション */}
					<section className="property-section">
						<h4 className="property-section__title">エフェクト</h4>

						<div className="property-control">
							<OpacitySlider
								value={selectedShapeStyles?.opacity ?? 1}
								onChange={(opacity) => handleStyleChange({ opacity })}
							/>
						</div>

						<div className="property-control">
							<ShadowSettings />
						</div>
					</section>

					{/* スタイルプリセット */}
					<section className="property-section">
						<StylePresets />
					</section>

					{/* スタイルアクション（コピー/ペースト） */}
					<div className="property-panel__footer">
						<StyleActions />
					</div>
				</div>
			)}
		</>
	);
};
