/**
 * Metadata for uSketch preset effects
 */
export const PRESET_EFFECTS_METADATA = {
	"usketch.ripple": {
		name: "リップル",
		description: "クリック時の波紋エフェクト",
		defaultConfig: {
			radius: 20,
			color: "#007bff",
			duration: 500,
			opacity: 0.5,
		},
	},
	"usketch.pin": {
		name: "ピン",
		description: "コメントや注釈用のピン",
		defaultConfig: {
			color: "#ff6b6b",
			size: 24,
		},
	},
	"usketch.highlight": {
		name: "ハイライト",
		description: "要素を強調表示",
		defaultConfig: {
			color: "#ffeb3b",
			opacity: 0.3,
			pulseAnimation: false,
		},
	},
	"usketch.cursor": {
		name: "カーソル",
		description: "他ユーザーのカーソル表示",
		defaultConfig: {
			size: 16,
			showName: true,
		},
	},
	"usketch.tooltip": {
		name: "ツールチップ",
		description: "ホバー時の情報表示",
		defaultConfig: {
			backgroundColor: "#333",
			textColor: "#fff",
			fontSize: 14,
		},
	},
	"usketch.fade": {
		name: "フェード",
		description: "フェードイン/アウトエフェクト",
		defaultConfig: {
			duration: 300,
			fadeIn: true,
			fadeOut: true,
		},
	},
} as const;

/**
 * Get all preset effect IDs
 */
export function getAllPresetIds(): string[] {
	return Object.keys(PRESET_EFFECTS_METADATA);
}

/**
 * Get metadata for a specific preset
 */
export function getPresetMetadata(id: string) {
	return PRESET_EFFECTS_METADATA[id as keyof typeof PRESET_EFFECTS_METADATA];
}
