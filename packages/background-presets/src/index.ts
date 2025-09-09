// コンポーネントのエクスポート

export type { DotsBackgroundConfig } from "./components/dots-background";
export { DotsBackground } from "./components/dots-background";
export type { GridBackgroundConfig } from "./components/grid-background";
export { GridBackground } from "./components/grid-background";
export type { IsometricBackgroundConfig } from "./components/isometric-background";
export { IsometricBackground } from "./components/isometric-background";
export type { LinesBackgroundConfig } from "./components/lines-background";
export { LinesBackground } from "./components/lines-background";
// メタデータのエクスポート
export { getAllPresetIds, PRESET_BACKGROUNDS_METADATA } from "./metadata";
// 型定義のエクスポート
export type { BackgroundComponent, BackgroundComponentProps } from "./types";

// レジストリに登録する関数
import type { BackgroundRegistry } from "@usketch/shared-types";
import { DotsBackground } from "./components/dots-background";
import { GridBackground } from "./components/grid-background";
import { IsometricBackground } from "./components/isometric-background";
import { LinesBackground } from "./components/lines-background";

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
