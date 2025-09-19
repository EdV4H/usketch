export interface StyleProperties {
	// 基本スタイル
	fillColor: string;
	strokeColor: string;
	strokeWidth: number;
	opacity: number;

	// 拡張スタイル（将来実装）
	strokeDasharray?: string;
	cornerRadius?: number;
	shadow?: ShadowProperties;
	gradient?: GradientProperties;
}

export interface ShadowProperties {
	offsetX: number;
	offsetY: number;
	blur: number;
	color: string;
}

export interface GradientProperties {
	type: "linear" | "radial";
	stops: GradientStop[];
	angle?: number; // for linear gradient
	centerX?: number; // for radial gradient
	centerY?: number; // for radial gradient
}

export interface GradientStop {
	offset: number;
	color: string;
}

export interface StylePreset {
	id: string;
	name: string;
	style: StyleProperties;
	createdAt: Date;
}

export interface StyleState {
	// 選択中形状の共通スタイル
	selectedShapeStyles: Partial<StyleProperties> | null;

	// スタイルプリセット
	stylePresets: StylePreset[];

	// コピー中のスタイル
	copiedStyle: StyleProperties | null;

	// 最近使った色（最大10色）
	recentColors: string[];
}

// デフォルトプリセット
export const DEFAULT_STYLE_PRESETS: StylePreset[] = [
	{
		id: "default-1",
		name: "Blue Fill",
		style: {
			fillColor: "#3b82f6",
			strokeColor: "#1e40af",
			strokeWidth: 2,
			opacity: 1,
		},
		createdAt: new Date("2025-09-19"),
	},
	{
		id: "default-2",
		name: "Red Outline",
		style: {
			fillColor: "transparent",
			strokeColor: "#ef4444",
			strokeWidth: 3,
			opacity: 1,
		},
		createdAt: new Date("2025-09-19"),
	},
	{
		id: "default-3",
		name: "Soft Green",
		style: {
			fillColor: "#86efac",
			strokeColor: "#16a34a",
			strokeWidth: 1,
			opacity: 0.8,
		},
		createdAt: new Date("2025-09-19"),
	},
];
