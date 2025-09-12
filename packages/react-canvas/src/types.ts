import type { EffectPlugin } from "@usketch/effect-registry";
import type { ShapePlugin } from "@usketch/shape-registry";
import type { Camera, Effect, Shape } from "@usketch/shared-types";
import type { BackgroundConfig } from "./hooks/use-background-renderer";

// Type for any shape plugin, regardless of specific shape type
export type AnyShapePlugin = ShapePlugin<Shape>;

// Type for any effect plugin, regardless of specific effect type
export type AnyEffectPlugin = EffectPlugin<Effect>;

export interface CanvasProps {
	className?: string;
	background?: BackgroundConfig;
	shapes?: readonly AnyShapePlugin[];
	effects?: readonly AnyEffectPlugin[];
	onReady?: (canvas: CanvasManager) => void;
}

export interface LayerProps {
	camera: Camera;
	className?: string;
}

export interface ShapeLayerProps extends LayerProps {
	shapes: Record<string, Shape>;
	activeTool?: string;
}

export interface SelectionLayerProps extends LayerProps {
	selectedIds: Set<string>;
	shapes: Record<string, Shape>;
}

export interface BackgroundLayerProps extends LayerProps {
	options?: BackgroundConfig;
}

export interface SelectionIndicatorProps {
	// ドラッグ選択ボックスの位置とサイズ
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
	// 表示状態
	visible: boolean;
	// カメラ情報（座標変換用）
	camera: Camera;
	// 選択中のアイテム数（プレビュー用）
	selectedCount?: number;
}

export interface InteractionLayerProps extends LayerProps {
	activeTool?: string;
	// カスタムSelectionIndicator
	selectionIndicator?: React.ComponentType<SelectionIndicatorProps>;
	selectionIndicatorClassName?: string;
	selectionIndicatorStyle?: React.CSSProperties;
}

export interface CanvasManager {
	addShape: (shape: Shape) => void;
	updateShape: (id: string, updates: Partial<Shape>) => void;
	deleteShape: (id: string) => void;
	selectShapes: (ids: string[]) => void;
	clearSelection: () => void;
	setTool: (tool: string) => void;
	undo: () => void;
	redo: () => void;
	zoomIn: () => void;
	zoomOut: () => void;
	resetZoom: () => void;
}
