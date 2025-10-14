import type {
	Camera,
	Command,
	CommandContext,
	Effect,
	Shape,
	WhiteboardState,
} from "@usketch/shared-types";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { SetCameraCommand } from "./commands/camera";
import {
	ClearSelectionCommand,
	DeselectShapeCommand,
	SelectShapeCommand,
	SetSelectionCommand,
} from "./commands/selection";
import {
	BatchUpdateShapesCommand,
	CreateShapeCommand,
	DeleteShapeCommand,
	UpdateShapeCommand,
} from "./commands/shape";
import { calculateDistribution, type DistributionDirection } from "./distribution-utils";
import { HistoryManager } from "./history/history-manager";
import { createStyleSlice, type StyleSlice } from "./slices/style-slice";

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
	type: "horizontal" | "vertical" | "distance" | "diagonal" | "threshold";
	position: number;
	start: { x: number; y: number };
	end: { x: number; y: number };
	// Smart guide specific properties
	distance?: number; // Distance value to display
	label?: string; // Optional label for the guide
	style?: "solid" | "dashed" | "dotted"; // Line style
}

export interface SnapSettings {
	enabled: boolean; // Master switch
	gridSnap: boolean; // Grid snapping
	gridSize: number; // Grid size
	shapeSnap: boolean; // Shape to shape snapping
	snapThreshold: number; // Snap threshold distance
	showGuides: boolean; // Show snap guides (dashed lines when snapped)
	showDistances: boolean; // Show distance indicators (measurements between shapes)
	showEqualSpacing: boolean; // Show equal spacing indicators
	showAlignmentGuides: boolean; // Show alignment guides (solid lines)
	// Performance settings
	snapCalculationRange: number; // Maximum distance to search for snap candidates (pixels)
	viewportMargin: number; // Extra margin around viewport for shape culling (pixels)
}

export interface WhiteboardStore extends WhiteboardState, StyleSlice {
	// State additions
	selectionIndicator: SelectionIndicatorState;
	snapGuides: SnapGuide[];
	snapSettings: SnapSettings;
	effects: Record<string, Effect>;
	effectToolConfig: {
		effectType: string; // Allow any effect type for extensibility
		effectConfig?: Record<string, any>;
	};

	// History management
	history: HistoryManager;
	canUndo: boolean;
	canRedo: boolean;

	// Actions
	addShape: (shape: Shape) => void;
	updateShape: (id: string, updates: Partial<Shape>) => void;
	batchUpdateShapes: (updates: Array<{ id: string; updates: Partial<Shape> }>) => void;
	removeShape: (id: string) => void;
	deleteShapes: (ids: string[]) => void;
	selectShape: (id: string) => void;
	deselectShape: (id: string) => void;
	clearSelection: () => void;
	setCamera: (camera: Partial<Camera>) => void;
	setCurrentTool: (tool: string) => void;

	// Multiple selection actions
	toggleSelection: (id: string) => void;
	selectAll: () => void;
	selectAllShapes: () => void;
	selectShapes: (ids: string[]) => void;
	setSelection: (ids: string[], options?: { skipHistory?: boolean }) => void;
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

	// Snap Settings actions
	updateSnapSettings: (settings: Partial<SnapSettings>) => void;
	toggleGridSnap: () => void;
	toggleShapeSnap: () => void;

	// Command execution
	executeCommand: (command: Command, options?: { skipHistory?: boolean }) => void;

	// Batch operations
	beginBatch: (description?: string) => void;
	endBatch: () => void;

	// Undo/Redo
	undo: () => boolean;
	redo: () => boolean;
	clearHistory: () => void;
	getHistoryDebugInfo: () => {
		commands: Array<{ description: string; timestamp: number; id: string }>;
		currentIndex: number;
	};

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

// Export StoreState type for StyleSlice
export type StoreState = WhiteboardStore;

// Create history manager instance
const historyManager = new HistoryManager({
	maxSize: 100,
	mergeThreshold: 1000,
});

// Helper function to create CommandContext
const createCommandContext = (get: any, set: any): CommandContext => ({
	getState: () => ({
		shapes: get().shapes,
		selectedShapeIds: get().selectedShapeIds,
		camera: get().camera,
		currentTool: get().currentTool,
	}),
	setState: (updater: (state: WhiteboardState) => void) => {
		set((currentState: WhiteboardStore) => {
			// Create a mutable copy of the current state for the updater
			const mutableState = {
				shapes: { ...currentState.shapes },
				selectedShapeIds: new Set(currentState.selectedShapeIds),
				camera: { ...currentState.camera },
				currentTool: currentState.currentTool,
			};

			// Apply the updates
			updater(mutableState);

			// Return the new state with updates applied
			return {
				...currentState,
				shapes: mutableState.shapes,
				selectedShapeIds: mutableState.selectedShapeIds,
				camera: mutableState.camera,
				currentTool: mutableState.currentTool,
			};
		});
	},
});

export const whiteboardStore = createStore<WhiteboardStore>((set, get, store) => ({
	// Initial state
	shapes: {},
	selectedShapeIds: new Set(),
	camera: { x: 0, y: 0, zoom: 1 },
	currentTool: "select",
	selectionIndicator: {
		bounds: null,
		visible: false,
		selectedCount: 0,
	},
	snapGuides: [],
	snapSettings: {
		enabled: true,
		gridSnap: false, // Changed default to false for better UX
		gridSize: 20,
		shapeSnap: true,
		snapThreshold: 8,
		showGuides: true,
		showDistances: false, // Changed default to false for cleaner UI
		showEqualSpacing: true, // Show equal spacing by default
		showAlignmentGuides: false, // Changed default to false for better UX
		snapCalculationRange: 500, // Increased default for better snap detection
		viewportMargin: 300, // Increased default for better coverage
	},
	effects: {},
	effectToolConfig: {
		effectType: "ripple",
		effectConfig: {},
	},
	canUndo: false,
	canRedo: false,

	// History management
	history: historyManager,

	// Command execution
	executeCommand: (command: Command, options?: { skipHistory?: boolean }) => {
		const context = createCommandContext(get, set);
		if (options?.skipHistory) {
			// Execute command directly without adding to history
			command.execute(context);
		} else {
			historyManager.execute(command, context);
			set({
				canUndo: historyManager.canUndo,
				canRedo: historyManager.canRedo,
			});
		}
	},

	// Actions - Now using commands for undo/redo support
	addShape: (shape: Shape) => {
		get().executeCommand(new CreateShapeCommand(shape));
	},

	updateShape: (id: string, updates: Partial<Shape>) => {
		get().executeCommand(new UpdateShapeCommand(id, updates));
	},

	batchUpdateShapes: (updates: Array<{ id: string; updates: Partial<Shape> }>) => {
		get().executeCommand(new BatchUpdateShapesCommand(updates));
	},

	removeShape: (id: string) => {
		get().executeCommand(new DeleteShapeCommand(id));
	},

	selectShape: (id: string) => {
		get().executeCommand(new SelectShapeCommand(id));
		// Update selected shape styles
		get().updateSelectedShapeStyles?.();
	},

	deselectShape: (id: string) => {
		get().executeCommand(new DeselectShapeCommand(id));
		// Update selected shape styles
		get().updateSelectedShapeStyles?.();
	},

	clearSelection: () => {
		get().executeCommand(new ClearSelectionCommand());
		// Update selected shape styles
		get().updateSelectedShapeStyles?.();
	},

	setCamera: (camera: Partial<Camera>) => {
		get().executeCommand(new SetCameraCommand(camera));
	},

	setCurrentTool: (tool: string) => {
		set((state) => ({
			...state,
			currentTool: tool,
		}));
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

	setSelection: (ids: string[], options?: { skipHistory?: boolean }) => {
		get().executeCommand(new SetSelectionCommand(ids), options);
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

	// Snap Settings actions
	updateSnapSettings: (settings: Partial<SnapSettings>) => {
		set((state) => ({
			...state,
			snapSettings: { ...state.snapSettings, ...settings },
		}));
	},

	toggleGridSnap: () => {
		set((state) => ({
			...state,
			snapSettings: {
				...state.snapSettings,
				gridSnap: !state.snapSettings.gridSnap,
			},
		}));
	},

	toggleShapeSnap: () => {
		set((state) => ({
			...state,
			snapSettings: {
				...state.snapSettings,
				shapeSnap: !state.snapSettings.shapeSnap,
			},
		}));
	},

	// Batch operations
	beginBatch: (description?: string) => {
		historyManager.beginBatch(description);
	},

	endBatch: () => {
		const context = createCommandContext(get, set);
		historyManager.endBatch(context);
		set({
			canUndo: historyManager.canUndo,
			canRedo: historyManager.canRedo,
		});
	},

	// Undo/Redo
	undo: () => {
		const context = createCommandContext(get, set);
		const result = historyManager.undo(context);
		set({
			canUndo: historyManager.canUndo,
			canRedo: historyManager.canRedo,
		});
		return result;
	},

	redo: () => {
		const context = createCommandContext(get, set);
		const result = historyManager.redo(context);
		set({
			canUndo: historyManager.canUndo,
			canRedo: historyManager.canRedo,
		});
		return result;
	},

	clearHistory: () => {
		historyManager.clear();
		set({
			canUndo: false,
			canRedo: false,
		});
	},

	getHistoryDebugInfo: () => {
		const commands = historyManager.commandHistory;
		return {
			commands: commands.map((cmd) => ({
				description: cmd.description,
				timestamp: cmd.timestamp,
				id: cmd.id,
			})),
			currentIndex: historyManager.currentCommandIndex,
		};
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

	// Add StyleSlice
	...createStyleSlice(set, get, store),
}));

// Export convenient accessor functions
export const useWhiteboardStore = <T = WhiteboardStore>(selector?: (state: WhiteboardStore) => T) =>
	useStore(whiteboardStore, selector || ((state) => state as T));
