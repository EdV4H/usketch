import type { Camera, Shape, WhiteboardState } from "@usketch/shared-types";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export interface SelectionIndicatorState {
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
	visible: boolean;
	selectedCount: number;
}

export interface WhiteboardStore extends WhiteboardState {
	// State additions
	activeTool: string;
	selectionIndicator: SelectionIndicatorState;

	// Actions
	addShape: (shape: Shape) => void;
	updateShape: (id: string, updates: Partial<Shape>) => void;
	removeShape: (id: string) => void;
	deleteShapes: (ids: string[]) => void;
	selectShape: (id: string) => void;
	deselectShape: (id: string) => void;
	clearSelection: () => void;
	setCamera: (camera: Partial<Camera>) => void;
	setCurrentTool: (tool: string) => void;
	setActiveTool: (tool: string) => void;

	// Multiple selection actions
	toggleSelection: (id: string) => void;
	selectAll: () => void;
	selectAllShapes: () => void;
	selectShapes: (ids: string[]) => void;
	setSelection: (ids: string[]) => void;
	removeSelectedShapes: () => void;

	// Selection Indicator actions
	setSelectionIndicator: (state: Partial<SelectionIndicatorState>) => void;
	showSelectionIndicator: (bounds?: {
		x: number;
		y: number;
		width: number;
		height: number;
	}) => void;
	hideSelectionIndicator: () => void;

	// Undo/Redo
	undo: () => void;
	redo: () => void;
}

export const whiteboardStore = createStore<WhiteboardStore>((set) => ({
	// Initial state
	shapes: {},
	selectedShapeIds: new Set(),
	camera: { x: 0, y: 0, zoom: 1 },
	currentTool: "select",
	activeTool: "select",
	selectionIndicator: {
		bounds: null,
		visible: false,
		selectedCount: 0,
	},

	// Actions
	addShape: (shape: Shape) => {
		set((state) => ({
			...state,
			shapes: { ...state.shapes, [shape.id]: shape },
		}));
	},

	updateShape: (id: string, updates: Partial<Shape>) => {
		set((state) => ({
			...state,
			shapes: {
				...state.shapes,
				[id]: { ...state.shapes[id], ...updates } as Shape,
			},
		}));
	},

	removeShape: (id: string) => {
		set((state) => {
			const newShapes = { ...state.shapes };
			delete newShapes[id];
			const newSelectedIds = new Set(state.selectedShapeIds);
			newSelectedIds.delete(id);
			return {
				...state,
				shapes: newShapes,
				selectedShapeIds: newSelectedIds,
			};
		});
	},

	selectShape: (id: string) => {
		set((state) => ({
			...state,
			selectedShapeIds: new Set([...state.selectedShapeIds, id]),
		}));
	},

	deselectShape: (id: string) => {
		set((state) => {
			const newSelectedIds = new Set(state.selectedShapeIds);
			newSelectedIds.delete(id);
			return { ...state, selectedShapeIds: newSelectedIds };
		});
	},

	clearSelection: () => {
		set((state) => ({ ...state, selectedShapeIds: new Set() }));
	},

	setCamera: (camera: Partial<Camera>) => {
		set((state) => ({
			...state,
			camera: { ...state.camera, ...camera },
		}));
	},

	setCurrentTool: (tool: string) => {
		set((state) => ({ ...state, currentTool: tool }));
	},

	setActiveTool: (tool: string) => {
		set((state) => ({ ...state, activeTool: tool }));
	},

	deleteShapes: (ids: string[]) => {
		set((state) => {
			const newShapes = { ...state.shapes };
			ids.forEach((id) => {
				delete newShapes[id];
			});
			const newSelectedIds = new Set(state.selectedShapeIds);
			ids.forEach((id) => {
				newSelectedIds.delete(id);
			});
			return {
				...state,
				shapes: newShapes,
				selectedShapeIds: newSelectedIds,
			};
		});
	},

	// Multiple selection actions
	toggleSelection: (id: string) => {
		set((state) => {
			const newSelectedIds = new Set(state.selectedShapeIds);
			if (newSelectedIds.has(id)) {
				newSelectedIds.delete(id);
			} else {
				newSelectedIds.add(id);
			}
			return { ...state, selectedShapeIds: newSelectedIds };
		});
	},

	selectAll: () => {
		set((state) => ({
			...state,
			selectedShapeIds: new Set(Object.keys(state.shapes)),
		}));
	},

	selectAllShapes: () => {
		set((state) => ({
			...state,
			selectedShapeIds: new Set(Object.keys(state.shapes)),
		}));
	},

	selectShapes: (ids: string[]) => {
		set((state) => ({
			...state,
			selectedShapeIds: new Set(ids),
		}));
	},

	setSelection: (ids: string[]) => {
		set((state) => ({
			...state,
			selectedShapeIds: new Set(ids),
		}));
	},

	removeSelectedShapes: () => {
		set((state) => {
			const newShapes = { ...state.shapes };
			state.selectedShapeIds.forEach((id) => {
				delete newShapes[id];
			});
			return {
				...state,
				shapes: newShapes,
				selectedShapeIds: new Set(),
			};
		});
	},

	// Selection Indicator actions
	setSelectionIndicator: (indicatorState: Partial<SelectionIndicatorState>) => {
		set((state) => ({
			...state,
			selectionIndicator: { ...state.selectionIndicator, ...indicatorState },
		}));
	},

	showSelectionIndicator: (bounds?: { x: number; y: number; width: number; height: number }) => {
		set((state) => ({
			...state,
			selectionIndicator: {
				bounds: bounds || { x: 0, y: 0, width: 0, height: 0 },
				visible: true,
				selectedCount: state.selectedShapeIds.size,
			},
		}));
	},

	hideSelectionIndicator: () => {
		set((state) => ({
			...state,
			selectionIndicator: {
				bounds: null,
				visible: false,
				selectedCount: 0,
			},
		}));
	},

	// Undo/Redo placeholders
	undo: () => {
		console.log("Undo not implemented");
	},

	redo: () => {
		console.log("Redo not implemented");
	},
}));

// Export convenient accessor functions
export const useWhiteboardStore = <T = WhiteboardStore>(selector?: (state: WhiteboardStore) => T) =>
	useStore(whiteboardStore, selector!);
