import { registerPresetBackgrounds as registerPresets } from "@usketch/background-presets";
import { globalBackgroundRegistry } from "./background-registry";

/**
 * uSketchが提供するプリセット背景を登録
 */
export function registerPresetBackgrounds(): void {
	registerPresets(globalBackgroundRegistry);
}

// メタデータとユーティリティ関数を再エクスポート
export { getAllPresetIds, PRESET_BACKGROUNDS_METADATA } from "@usketch/background-presets";
