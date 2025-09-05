import type React from "react";
import { useMemo } from "react";
import { useBackgroundRenderer } from "../hooks/useBackgroundRenderer";
import type { BackgroundLayerProps } from "../types";
import {
	type BackgroundComponent,
	DotsBackground,
	GridBackground,
	IsometricBackground,
	LinesBackground,
} from "./BackgroundComponent";

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({
	camera,
	options,
	className = "",
}) => {
	// 後方互換性のためにフックは呼び出すが、実際には使用しない
	const containerRef = useBackgroundRenderer(camera, options);

	// 背景コンポーネントを選択
	const BackgroundComp = useMemo(() => {
		if (!options || options.type === "none") {
			return null;
		}

		// カスタムコンポーネントが指定されている場合
		if (options.type === "component" && options.component) {
			return options.component as BackgroundComponent;
		}

		// プリセット背景の場合
		switch (options.type) {
			case "dots":
				return DotsBackground;
			case "grid":
				return GridBackground;
			case "lines":
				return LinesBackground;
			case "isometric":
				return IsometricBackground;
			default:
				return null;
		}
	}, [options]);

	// 背景設定を準備
	const config = useMemo(() => {
		if (!options) return {};

		// カスタムコンポーネントの設定
		if (options.type === "component") {
			return options.config || {};
		}

		// プリセット背景の設定
		return {
			spacing: options.spacing,
			size: options.size,
			color: options.color,
			thickness: options.thickness,
			direction: options.direction,
		};
	}, [options]);

	// 背景なしの場合
	if (!BackgroundComp) {
		return (
			<div
				ref={containerRef}
				className={`background-layer ${className}`.trim()}
				data-testid="background-layer"
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
				}}
			/>
		);
	}

	// Reactコンポーネントをレンダリング
	return (
		<div
			className={`background-layer ${className}`.trim()}
			data-testid="background-layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		>
			<BackgroundComp camera={camera} config={config} />
		</div>
	);
};
