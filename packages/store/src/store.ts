import type { Camera, Effect, Shape, WhiteboardState } from "@usketch/shared-types";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { calculateDistribution, type DistributionDirection } from "./distribution-utils";

export type AlignmentDirection =
	| "left"
	| "right"
	| "top"
	| "bottom"
	| "center-horizontal"
	| "center-vertical";

export type { DistributionDirection } from "./distribution-utils";

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

export interface SnapGuide {
	type: "horizontal" | "vertical" | "distance";
	position: number;
	start: { x: number; y: number };
	end: { x: number; y: number };
	// Smart guide specific properties
	distance?: number; // Distance value to display
	label?: string; // Optional label for the guide
	style?: "solid" | "dashed" | "dotted"; // Line style
}

export interface WhiteboardStore extends WhiteboardState {
	// State additions
	activeTool: string;
	selectionIndicator: SelectionIndicatorState;
	snapGuides: SnapGuide[];
	effects: Record<string, Effect>;
	effectToolConfig: {
		effectType: string; // Allow any effect type for extensibility
		effectConfig?: Record<string, any>;
	};

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

	// Alignment actions
	alignShapes: (direction: AlignmentDirection) => void;
	alignShapesLeft: () => void;
	alignShapesRight: () => void;
	alignShapesTop: () => void;
	alignShapesBottom: () => void;
	alignShapesCenterHorizontal: () => void;
	alignShapesCenterVertical: () => void;

	// Distribution actions
	distributeShapes: (direction: DistributionDirection) => Promise<void>;
	distributeShapesHorizontally: () => Promise<void>;
	distributeShapesVertically: () => Promise<void>;

	// Selection Indicator actions
	setSelectionIndicator: (state: Partial<SelectionIndicatorState>) => void;
	showSelectionIndicator: (bounds?: {
		x: number;
		y: number;
		width: number;
		height: number;
	}) => void;
	hideSelectionIndicator: () => void;

	// Snap Guide actions
	setSnapGuides: (guides: SnapGuide[]) => void;
	clearSnapGuides: () => void;

	// Undo/Redo
	undo: () => void;
	redo: () => void;

	// Effect actions
	addEffect: (effect: Effect) => void;
	removeEffect: (id: string) => void;
	updateEffect: (id: string, updates: Partial<Effect>) => void;
	clearEffects: (type?: string) => void;
	clearExpiredEffects: () => void;
	setEffectToolConfig: (
		config: Partial<{
			effectType: string;
			effectConfig?: Record<string, any>;
		}>,
	) => void;
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
	snapGuides: [],
	effects: {},
	effectToolConfig: {
		effectType: "ripple",
		effectConfig: {},
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

	// Snap Guide actions
	setSnapGuides: (guides: SnapGuide[]) => {
		set((state) => ({
			...state,
			snapGuides: guides,
		}));
	},

	clearSnapGuides: () => {
		set((state) => ({
			...state,
			snapGuides: [],
		}));
	},

	// Alignment actions
	alignShapes: (direction: AlignmentDirection) => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };

			switch (direction) {
				case "left": {
					const leftMost = Math.min(...selectedShapes.map((s) => s.x));
					selectedShapes.forEach((shape) => {
						updatedShapes[shape.id] = { ...shape, x: leftMost } as Shape;
					});
					break;
				}
				case "right": {
					const rightMost = Math.max(
						...selectedShapes.map((s) => {
							const width = "width" in s ? s.width : 0;
							return s.x + width;
						}),
					);
					selectedShapes.forEach((shape) => {
						const width = "width" in shape ? shape.width : 0;
						updatedShapes[shape.id] = { ...shape, x: rightMost - width } as Shape;
					});
					break;
				}
				case "top": {
					const topMost = Math.min(...selectedShapes.map((s) => s.y));
					selectedShapes.forEach((shape) => {
						updatedShapes[shape.id] = { ...shape, y: topMost } as Shape;
					});
					break;
				}
				case "bottom": {
					const bottomMost = Math.max(
						...selectedShapes.map((s) => {
							const height = "height" in s ? s.height : 0;
							return s.y + height;
						}),
					);
					selectedShapes.forEach((shape) => {
						const height = "height" in shape ? shape.height : 0;
						updatedShapes[shape.id] = { ...shape, y: bottomMost - height } as Shape;
					});
					break;
				}
				case "center-horizontal": {
					const xs = selectedShapes.flatMap((s) => {
						const width = "width" in s ? s.width : 0;
						return [s.x, s.x + width];
					});
					const left = Math.min(...xs);
					const right = Math.max(...xs);
					const centerX = (left + right) / 2;
					selectedShapes.forEach((shape) => {
						const width = "width" in shape ? shape.width : 0;
						updatedShapes[shape.id] = { ...shape, x: centerX - width / 2 } as Shape;
					});
					break;
				}
				case "center-vertical": {
					const ys = selectedShapes.flatMap((s) => {
						const height = "height" in s ? s.height : 0;
						return [s.y, s.y + height];
					});
					const top = Math.min(...ys);
					const bottom = Math.max(...ys);
					const centerY = (top + bottom) / 2;
					selectedShapes.forEach((shape) => {
						const height = "height" in shape ? shape.height : 0;
						updatedShapes[shape.id] = { ...shape, y: centerY - height / 2 } as Shape;
					});
					break;
				}
			}

			return { ...state, shapes: updatedShapes };
		});
	},

	alignShapesLeft: () => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };
			const leftMost = Math.min(...selectedShapes.map((s) => s.x));
			selectedShapes.forEach((shape) => {
				updatedShapes[shape.id] = { ...shape, x: leftMost } as Shape;
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	alignShapesRight: () => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };
			const rightMost = Math.max(
				...selectedShapes.map((s) => {
					const width = "width" in s ? s.width : 0;
					return s.x + width;
				}),
			);
			selectedShapes.forEach((shape) => {
				const width = "width" in shape ? shape.width : 0;
				updatedShapes[shape.id] = { ...shape, x: rightMost - width } as Shape;
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	alignShapesTop: () => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };
			const topMost = Math.min(...selectedShapes.map((s) => s.y));
			selectedShapes.forEach((shape) => {
				updatedShapes[shape.id] = { ...shape, y: topMost } as Shape;
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	alignShapesBottom: () => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };
			const bottomMost = Math.max(
				...selectedShapes.map((s) => {
					const height = "height" in s ? s.height : 0;
					return s.y + height;
				}),
			);
			selectedShapes.forEach((shape) => {
				const height = "height" in shape ? shape.height : 0;
				updatedShapes[shape.id] = { ...shape, y: bottomMost - height } as Shape;
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	alignShapesCenterHorizontal: () => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };
			const xs = selectedShapes.flatMap((s) => {
				const width = "width" in s ? s.width : 0;
				return [s.x, s.x + width];
			});
			const left = Math.min(...xs);
			const right = Math.max(...xs);
			const centerX = (left + right) / 2;
			selectedShapes.forEach((shape) => {
				const width = "width" in shape ? shape.width : 0;
				updatedShapes[shape.id] = { ...shape, x: centerX - width / 2 } as Shape;
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	alignShapesCenterVertical: () => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 2) return state;

			const updatedShapes = { ...state.shapes };
			const ys = selectedShapes.flatMap((s) => {
				const height = "height" in s ? s.height : 0;
				return [s.y, s.y + height];
			});
			const top = Math.min(...ys);
			const bottom = Math.max(...ys);
			const centerY = (top + bottom) / 2;
			selectedShapes.forEach((shape) => {
				const height = "height" in shape ? shape.height : 0;
				updatedShapes[shape.id] = { ...shape, y: centerY - height / 2 } as Shape;
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	// Distribution actions
	distributeShapes: async (direction: DistributionDirection) => {
		set((state) => {
			const selectedShapes = Array.from(state.selectedShapeIds)
				.map((id) => state.shapes[id])
				.filter((s): s is Shape => s !== undefined);

			if (selectedShapes.length < 3) return state; // Need at least 3 shapes

			// Calculate distribution
			const updates = calculateDistribution(selectedShapes, direction);

			const updatedShapes = { ...state.shapes };
			updates.forEach((position: { x: number; y: number }, shapeId: string) => {
				const shape = state.shapes[shapeId];
				if (shape) {
					updatedShapes[shapeId] = { ...shape, ...position } as Shape;
				}
			});

			return { ...state, shapes: updatedShapes };
		});
	},

	distributeShapesHorizontally: async () => {
		await whiteboardStore.getState().distributeShapes("horizontal");
	},

	distributeShapesVertically: async () => {
		await whiteboardStore.getState().distributeShapes("vertical");
	},

	// Undo/Redo placeholders
	undo: () => {
		// Undo not implemented
	},

	redo: () => {
		// Redo not implemented
	},

	// Effect actions
	addEffect: (effect: Effect) => {
		set((state) => ({
			...state,
			effects: { ...state.effects, [effect.id]: effect },
		}));
	},

	removeEffect: (id: string) => {
		set((state) => {
			const newEffects = { ...state.effects };
			delete newEffects[id];
			return {
				...state,
				effects: newEffects,
			};
		});
	},

	updateEffect: (id: string, updates: Partial<Effect>) => {
		set((state) => ({
			...state,
			effects: {
				...state.effects,
				[id]: { ...state.effects[id], ...updates } as Effect,
			},
		}));
	},

	clearEffects: (type?: string) => {
		set((state) => {
			if (!type) {
				return { ...state, effects: {} };
			}
			const newEffects = { ...state.effects };
			Object.keys(newEffects).forEach((id) => {
				const effect = newEffects[id];
				if (effect && effect.type === type) {
					delete newEffects[id];
				}
			});
			return { ...state, effects: newEffects };
		});
	},

	clearExpiredEffects: () => {
		set((state) => {
			const now = Date.now();
			const newEffects = { ...state.effects };
			Object.keys(newEffects).forEach((id) => {
				const effect = newEffects[id];
				if (effect?.duration && effect.createdAt + effect.duration < now) {
					delete newEffects[id];
				}
			});
			return { ...state, effects: newEffects };
		});
	},

	setEffectToolConfig: (config) => {
		set((state) => ({
			...state,
			effectToolConfig: { ...state.effectToolConfig, ...config },
		}));
	},
}));

// Export convenient accessor functions
export const useWhiteboardStore = <T = WhiteboardStore>(selector?: (state: WhiteboardStore) => T) =>
	useStore(whiteboardStore, selector || ((state) => state as T));
