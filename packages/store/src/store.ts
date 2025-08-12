import type { Camera, Shape, WhiteboardState } from "@usketch/shared-types";
import { createStore } from "zustand/vanilla";

export interface WhiteboardStore extends WhiteboardState {
	// Actions
	addShape: (shape: Shape) => void;
	updateShape: (id: string, updates: Partial<Shape>) => void;
	removeShape: (id: string) => void;
	selectShape: (id: string) => void;
	deselectShape: (id: string) => void;
	clearSelection: () => void;
	setCamera: (camera: Partial<Camera>) => void;
	setCurrentTool: (tool: string) => void;
}

export const whiteboardStore = createStore<WhiteboardStore>((set) => ({
	// Initial state
	shapes: {},
	selectedShapeIds: new Set(),
	camera: { x: 0, y: 0, zoom: 1 },
	currentTool: "select",

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
}));

// Export convenient accessor functions
export const useWhiteboardStore = whiteboardStore;
