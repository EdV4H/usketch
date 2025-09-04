import {
	type BackgroundRenderer,
	type DotsConfig,
	DotsRenderer,
	type GridConfig,
	GridRenderer,
	type IsometricConfig,
	IsometricRenderer,
	type LinesConfig,
	LinesRenderer,
	NoneRenderer,
} from "@usketch/backgrounds";
import type { Camera } from "@usketch/shared-types";
import { useEffect, useRef } from "react";

export type BackgroundType = "none" | "dots" | "grid" | "lines" | "isometric" | "custom";

export interface BackgroundConfig {
	type: BackgroundType;
	spacing?: number;
	size?: number;
	color?: string;
	thickness?: number;
	direction?: "horizontal" | "vertical" | "both";
	// カスタムレンダラー用
	renderer?: BackgroundRenderer<any>;
	config?: any;
}

export function useBackgroundRenderer(camera: Camera, options?: BackgroundConfig) {
	const containerRef = useRef<HTMLDivElement>(null);
	const rendererRef = useRef<BackgroundRenderer<any> | null>(null);
	const lastTypeRef = useRef<string>("");

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const config = options || { type: "dots" };

		// レンダラーが未作成または種類が変更された場合は新しく作成
		if (!rendererRef.current || lastTypeRef.current !== config.type) {
			// カスタムレンダラーの場合
			if (config.type === "custom" && config.renderer) {
				rendererRef.current = config.renderer;
			} else {
				// プリセットレンダラーの場合
				switch (config.type) {
					case "none":
						rendererRef.current = new NoneRenderer();
						break;
					case "dots":
						rendererRef.current = new DotsRenderer();
						break;
					case "grid":
						rendererRef.current = new GridRenderer();
						break;
					case "lines":
						rendererRef.current = new LinesRenderer();
						break;
					case "isometric":
						rendererRef.current = new IsometricRenderer();
						break;
					default:
						rendererRef.current = new DotsRenderer();
				}
			}
			lastTypeRef.current = config.type;
		}

		// レンダリング実行
		if (config.type === "custom" && config.renderer) {
			// カスタムレンダラーを使用
			rendererRef.current.render(container, camera, config.config);
		} else {
			// プリセットレンダラーを使用
			switch (config.type) {
				case "none":
					(rendererRef.current as NoneRenderer).render(container, camera);
					break;
				case "dots":
					(rendererRef.current as DotsRenderer).render(container, camera, {
						spacing: config.spacing,
						size: config.size,
						color: config.color,
					} as DotsConfig);
					break;
				case "grid":
					(rendererRef.current as GridRenderer).render(container, camera, {
						size: config.size,
						color: config.color,
						thickness: config.thickness,
					} as GridConfig);
					break;
				case "lines":
					(rendererRef.current as LinesRenderer).render(container, camera, {
						direction: config.direction,
						spacing: config.spacing,
						color: config.color,
						thickness: config.thickness,
					} as LinesConfig);
					break;
				case "isometric":
					(rendererRef.current as IsometricRenderer).render(container, camera, {
						size: config.size,
						color: config.color,
					} as IsometricConfig);
					break;
			}
		}
	}, [camera, options]);

	// クリーンアップ
	useEffect(() => {
		return () => {
			const container = containerRef.current;
			if (container && rendererRef.current && rendererRef.current.cleanup) {
				rendererRef.current.cleanup(container);
			}
		};
	}, []);

	return containerRef;
}
