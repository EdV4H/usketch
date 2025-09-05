import { registerPresetBackgrounds as registerPresets } from "@usketch/background-presets";
import { globalBackgroundRegistry } from "./BackgroundRegistry";

/**
 * uSketchが提供するプリセット背景を登録
 */
export function registerPresetBackgrounds(): void {
	registerPresets(globalBackgroundRegistry);
}

// メタデータとユーティリティ関数を再エクスポート
export {
	getAllPresetIds,
	getPresetsByCategory,
	PRESET_BACKGROUNDS_METADATA,
	type PresetCategory,
} from "@usketch/background-presets";
