// コンポーネントのエクスポート

export type { DotsBackgroundConfig } from "./components/DotsBackground";
export { DotsBackground } from "./components/DotsBackground";
export type { GridBackgroundConfig } from "./components/GridBackground";
export { GridBackground } from "./components/GridBackground";
export type { IsometricBackgroundConfig } from "./components/IsometricBackground";
export { IsometricBackground } from "./components/IsometricBackground";
export type { LinesBackgroundConfig } from "./components/LinesBackground";
export { LinesBackground } from "./components/LinesBackground";
// メタデータのエクスポート
export { getAllPresetIds, PRESET_BACKGROUNDS_METADATA } from "./metadata";
// 型定義のエクスポート
export type { BackgroundComponent, BackgroundComponentProps } from "./types";

// レジストリに登録する関数
import type { BackgroundRegistry } from "@usketch/shared-types";
import { DotsBackground } from "./components/DotsBackground";
import { GridBackground } from "./components/GridBackground";
import { IsometricBackground } from "./components/IsometricBackground";
import { LinesBackground } from "./components/LinesBackground";

/**
 * uSketchプリセット背景をレジストリに登録
 */
export function registerPresetBackgrounds(registry: BackgroundRegistry): void {
	registry.registerMultiple({
		// 基本的な背景
		"usketch.dots": DotsBackground,
		"usketch.grid": GridBackground,
		"usketch.lines": LinesBackground,
		"usketch.isometric": IsometricBackground,
	});
}
