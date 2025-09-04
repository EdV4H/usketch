import type { BackgroundOptions, Camera, Shape } from "@usketch/shared-types";

export interface CanvasProps {
	className?: string;
	background?: BackgroundOptions;
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
	options?: BackgroundOptions;
}

export interface InteractionLayerProps extends LayerProps {
	activeTool?: string;
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
