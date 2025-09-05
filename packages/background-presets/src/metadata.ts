/**
 * uSketchプリセット背景のメタデータ
 */
export const PRESET_BACKGROUNDS_METADATA = {
	"usketch.dots": {
		name: "ドット",
		description: "等間隔に配置されたドットパターン",
		category: "basic",
		defaultConfig: {
			spacing: 20,
			size: 2,
			color: "#d0d0d0",
		},
	},
	"usketch.grid": {
		name: "グリッド",
		description: "格子状のグリッドパターン",
		category: "basic",
		defaultConfig: {
			size: 40,
			color: "#e0e0e0",
			thickness: 1,
		},
	},
	"usketch.lines": {
		name: "ライン",
		description: "水平または垂直の線パターン",
		category: "basic",
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
		category: "basic",
		defaultConfig: {
			size: 40,
			color: "#e0e0e0",
		},
	},
	"usketch.gradient": {
		name: "グラデーション",
		description: "2色のグラデーション背景",
		category: "effect",
		defaultConfig: {
			startColor: "#ff0000",
			endColor: "#0000ff",
			angle: 45,
		},
	},
	"usketch.pulse": {
		name: "パルス",
		description: "パルスアニメーション効果",
		category: "effect",
		defaultConfig: {
			color: "#007acc",
			speed: 2000,
		},
	},
} as const;

/**
 * プリセット背景のカテゴリー
 */
export type PresetCategory = "basic" | "effect";

/**
 * カテゴリー別にプリセットIDを取得
 */
export function getPresetsByCategory(category: PresetCategory): string[] {
	return Object.entries(PRESET_BACKGROUNDS_METADATA)
		.filter(([_, metadata]) => metadata.category === category)
		.map(([id]) => id);
}

/**
 * すべてのプリセットIDを取得
 */
export function getAllPresetIds(): string[] {
	return Object.keys(PRESET_BACKGROUNDS_METADATA);
}
