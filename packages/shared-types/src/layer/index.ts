/**
 * Layer management types for grouping and organizing shapes
 */

export interface Layer {
	id: string;
	name: string;
	visible: boolean;
	locked: boolean;
	opacity: number;
	parentId: string | null;
	childIds: string[];
	shapeIds: string[];
	collapsed?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface LayerGroup {
	id: string;
	name: string;
	layerIds: string[];
	parentGroupId: string | null;
	collapsed?: boolean;
}

export interface LayerState {
	// All layers in the whiteboard
	layers: Map<string, Layer>;

	// Layer order (top to bottom)
	layerOrder: string[];

	// Active/selected layer
	activeLayerId: string | null;

	// Groups of layers
	layerGroups: Map<string, LayerGroup>;
}

export interface LayerActions {
	// Layer CRUD operations
	addLayer: (name?: string) => string;
	deleteLayer: (layerId: string) => void;
	renameLayer: (layerId: string, name: string) => void;
	duplicateLayer: (layerId: string) => string;

	// Layer visibility and locking
	toggleLayerVisibility: (layerId: string) => void;
	toggleLayerLock: (layerId: string) => void;
	setLayerOpacity: (layerId: string, opacity: number) => void;

	// Layer ordering
	moveLayerUp: (layerId: string) => void;
	moveLayerDown: (layerId: string) => void;
	moveLayerToTop: (layerId: string) => void;
	moveLayerToBottom: (layerId: string) => void;
	reorderLayers: (newOrder: string[]) => void;

	// Shape-layer association
	moveShapeToLayer: (shapeId: string, targetLayerId: string) => void;
	moveShapesToLayer: (shapeIds: string[], targetLayerId: string) => void;

	// Group operations
	groupLayers: (layerIds: string[], groupName?: string) => string;
	ungroupLayers: (groupId: string) => void;
	toggleGroupCollapse: (groupId: string) => void;

	// Selection
	selectLayer: (layerId: string) => void;
	selectMultipleLayers: (layerIds: string[]) => void;

	// Utility
	getLayerByShapeId: (shapeId: string) => Layer | null;
	getShapesInLayer: (layerId: string) => string[];
	mergeLayersDown: (layerId: string) => void;
}

// Default layer that always exists
export const DEFAULT_LAYER: Layer = {
	id: "default-layer",
	name: "Default Layer",
	visible: true,
	locked: false,
	opacity: 1,
	parentId: null,
	childIds: [],
	shapeIds: [],
	collapsed: false,
	createdAt: new Date(),
	updatedAt: new Date(),
};

// Z-index calculation based on layer order
export interface ZIndexManager {
	getZIndex: (shapeId: string) => number;
	moveToFront: (shapeId: string) => void;
	moveToBack: (shapeId: string) => void;
	moveForward: (shapeId: string) => void;
	moveBackward: (shapeId: string) => void;
	swapZIndex: (shapeId1: string, shapeId2: string) => void;
}
