/**
 * uSketchプリセット背景のメタデータ
 */
export const PRESET_BACKGROUNDS_METADATA = {
	"usketch.dots": {
		name: "ドット",
		description: "等間隔に配置されたドットパターン",
		defaultConfig: {
			spacing: 20,
			size: 2,
			color: "#d0d0d0",
		},
	},
	"usketch.grid": {
		name: "グリッド",
		description: "格子状のグリッドパターン",
		defaultConfig: {
			size: 40,
			color: "#e0e0e0",
			thickness: 1,
		},
	},
	"usketch.lines": {
		name: "ライン",
		description: "水平または垂直の線パターン",
		defaultConfig: {
			direction: "horizontal" as const,
			spacing: 40,
			color: "#e0e0e0",
			thickness: 1,
		},
	},
	"usketch.isometric": {
		name: "アイソメトリック",
		description: "アイソメトリック投影のグリッド",
		defaultConfig: {
			size: 40,
			color: "#e0e0e0",
		},
	},
} as const;

/**
 * すべてのプリセットIDを取得
 */
export function getAllPresetIds(): string[] {
	return Object.keys(PRESET_BACKGROUNDS_METADATA);
}
