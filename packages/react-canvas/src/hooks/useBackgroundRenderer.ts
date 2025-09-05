import type { Camera } from "@usketch/shared-types";
import { useRef } from "react";
import type { BackgroundComponent } from "../backgrounds/types";

/**
 * 背景の設定
 */
export interface BackgroundConfig {
	/**
	 * 背景の識別子
	 * - プリセット: "usketch.dots", "usketch.grid" など
	 * - カスタム: 任意の文字列（例: "myapp.custom", "user.gradient"）
	 */
	id: string;

	/**
	 * 背景コンポーネント（直接指定する場合）
	 * - IDがレジストリに登録されていない場合に使用
	 * - IDが登録されていても、こちらが優先される
	 */
	component?: BackgroundComponent;

	/**
	 * 背景固有の設定
	 * - 各背景コンポーネントが定義する設定を渡す
	 */
	config?: any;
}

/**
 * @deprecated このフックは廃止予定です。
 * BackgroundLayerコンポーネントで直接BackgroundRegistryを使用してください。
 */
export function useBackgroundRenderer(_camera: Camera, _options?: BackgroundConfig) {
	const containerRef = useRef<HTMLDivElement>(null);

	// このフックは後方互換性のために残されていますが、
	// 実際のレンダリングは行いません。
	// BackgroundLayerコンポーネントがBackgroundRegistryとReactコンポーネントを使用します。

	return containerRef;
}
