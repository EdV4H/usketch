import type { Camera } from "@usketch/shared-types";
import { useRef } from "react";

export type BackgroundType = "none" | "dots" | "grid" | "lines" | "isometric" | "component";

export interface BackgroundConfig {
	type: BackgroundType;
	spacing?: number;
	size?: number;
	color?: string;
	thickness?: number;
	direction?: "horizontal" | "vertical" | "both";
	// Reactコンポーネント用
	component?: React.ComponentType<any>;
	config?: any;
}

/**
 * @deprecated DOM操作ベースのレンダラーは廃止されました。
 * BackgroundLayerコンポーネントで直接Reactコンポーネントを使用してください。
 */
export function useBackgroundRenderer(camera: Camera, options?: BackgroundConfig) {
	const containerRef = useRef<HTMLDivElement>(null);

	// このフックは後方互換性のために残されていますが、
	// 実際のレンダリングは行いません。
	// BackgroundLayerコンポーネントがReactコンポーネントを直接レンダリングします。

	return containerRef;
}
