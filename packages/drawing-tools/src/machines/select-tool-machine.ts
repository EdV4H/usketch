import type { Bounds, Point } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { assign, fromCallback } from "xstate";
import { createToolMachine } from "./tool-machine-factory";
import type { PointerToolEvent, ToolContext } from "./types";

// === Select Tool Context ===
export interface SelectToolContext extends ToolContext {
	dragStart: Point | null;
	dragOffset: Point;
	selectionBox: Bounds | null;
	initialPositions: Map<string, Point>;
	isMultiSelect: boolean;
}

// === Select Tool Events ===
export type SelectToolEvent =
	| PointerToolEvent
	| { type: "DOUBLE_CLICK"; point: Point; target?: string }
	| { type: "DELETE" }
	| { type: "ESCAPE" }
	| { type: "ENTER_CROP_MODE"; shapeId: string }
	| { type: "CLEAR_SELECTION" }
	| { type: "SELECT_ALL" };

// === Helper Functions ===
function getShapeAtPoint(point: Point): string | null {
	const state = whiteboardStore.getState();
	// Simple hit detection - should be improved
	for (const [id, shape] of Object.entries(state.shapes)) {
		if (
			point.x >= shape.x &&
			point.x <= shape.x + shape.width &&
			point.y >= shape.y &&
			point.y <= shape.y + shape.height
		) {
			return id;
		}
	}
	return null;
}

function getShapesInBounds(bounds: Bounds): string[] {
	const state = whiteboardStore.getState();
	const intersecting: string[] = [];

	for (const [id, shape] of Object.entries(state.shapes)) {
		// Check if shape intersects with selection bounds
		if (
			shape.x < bounds.x + bounds.width &&
			shape.x + shape.width > bounds.x &&
			shape.y < bounds.y + bounds.height &&
			shape.y + shape.height > bounds.y
		) {
			intersecting.push(id);
		}
	}

	return intersecting;
}

// === Select Tool State Machine ===
export const selectToolMachine = createToolMachine<SelectToolContext, SelectToolEvent>({
	id: "selectTool",

	context: {
		cursor: "default",
		selectedIds: new Set(),
		hoveredId: null,
		dragStart: null,
		dragOffset: { x: 0, y: 0 },
		selectionBox: null,
		initialPositions: new Map(),
		isMultiSelect: false,
	},

	states: {
		idle: {
			entry: ["resetCursor", "clearTemporaryData"],

			on: {
				POINTER_DOWN: [
					{
						target: "translating",
						cond: "isPointOnSelectedShape",
						actions: "startTranslating",
					},
					{
						target: "selecting.single",
						cond: "isPointOnShape",
						actions: "selectShape",
					},
					{
						target: "selecting.brush",
						actions: "startBrushSelection",
					},
				],

				POINTER_MOVE: {
					actions: "updateHover",
				},

				DOUBLE_CLICK: {
					target: "cropping",
					cond: "isPointOnShape",
					actions: "enterCropMode",
				},

				DELETE: {
					actions: "deleteSelectedShapes",
					cond: "hasSelection",
				},

				SELECT_ALL: {
					actions: "selectAllShapes",
				},

				CLEAR_SELECTION: {
					actions: "clearSelection",
				},
			},
		},

		// === Hierarchical state: Selection modes ===
		selecting: {
			initial: "single",

			states: {
				single: {
					on: {
						POINTER_UP: {
							target: "#selectTool.idle",
						},
						POINTER_MOVE: [
							{
								target: "brush",
								cond: "isDragging",
								actions: "startBrushFromSingle",
							},
						],
					},
				},

				brush: {
					entry: "showSelectionBox",
					exit: "hideSelectionBox",

					on: {
						POINTER_MOVE: {
							actions: "updateSelectionBox",
						},
						POINTER_UP: {
							target: "#selectTool.idle",
							actions: "finalizeSelection",
						},
					},
				},
			},

			on: {
				ESCAPE: {
					target: "idle",
					actions: "clearSelection",
				},
			},
		},

		// === Translating (dragging) state ===
		translating: {
			entry: ["setCursorMove", "recordInitialPositions"],
			exit: "commitTranslation",

			on: {
				POINTER_MOVE: {
					actions: "updateTranslation",
				},
				POINTER_UP: {
					target: "idle",
				},
				ESCAPE: {
					target: "idle",
					actions: "cancelTranslation",
				},
			},

			// Service for snapping
			invoke: {
				id: "snappingService",
				src: "snappingService",
			},
		},

		// === Cropping state (simplified for now) ===
		cropping: {
			entry: "setupCropMode",
			exit: "teardownCropMode",

			on: {
				ESCAPE: {
					target: "idle",
					actions: "exitCropMode",
				},
				ENTER: {
					target: "idle",
					actions: "applyCrop",
				},
			},
		},
	},

	actions: {
		// Cursor management
		resetCursor: assign({
			cursor: "default",
		}),

		setCursorMove: assign({
			cursor: "move",
		}),

		// Data management
		clearTemporaryData: assign({
			dragStart: null,
			dragOffset: { x: 0, y: 0 },
			selectionBox: null,
			initialPositions: new Map(),
		}),

		// Selection actions
		selectShape: assign((context, event: PointerToolEvent) => {
			const shapeId = getShapeAtPoint(event.point);
			if (!shapeId) return {};

			const selectedIds = new Set(context.selectedIds);

			if (event.shiftKey || event.metaKey) {
				// Multi-select
				if (selectedIds.has(shapeId)) {
					selectedIds.delete(shapeId);
				} else {
					selectedIds.add(shapeId);
				}
			} else {
				// Single select
				selectedIds.clear();
				selectedIds.add(shapeId);
			}

			whiteboardStore.getState().setSelectedShapeIds(selectedIds);

			return { selectedIds };
		}),

		selectAllShapes: assign(() => {
			const state = whiteboardStore.getState();
			const allIds = new Set(Object.keys(state.shapes));
			whiteboardStore.getState().setSelectedShapeIds(allIds);
			return { selectedIds: allIds };
		}),

		clearSelection: assign(() => {
			whiteboardStore.getState().clearSelection();
			return { selectedIds: new Set() };
		}),

		deleteSelectedShapes: (context) => {
			context.selectedIds.forEach((id) => {
				whiteboardStore.getState().deleteShape(id);
			});
		},

		// Hover actions
		updateHover: assign((context, event: PointerToolEvent) => {
			const shapeId = getShapeAtPoint(event.point);
			return {
				hoveredId: shapeId,
				cursor: shapeId ? "pointer" : "default",
			};
		}),

		// Translation actions
		startTranslating: assign((context, event: PointerToolEvent) => ({
			dragStart: event.point,
			dragOffset: { x: 0, y: 0 },
		})),

		recordInitialPositions: assign((context) => {
			const positions = new Map<string, Point>();
			const state = whiteboardStore.getState();

			context.selectedIds.forEach((id) => {
				const shape = state.shapes[id];
				if (shape) {
					positions.set(id, { x: shape.x, y: shape.y });
				}
			});

			return { initialPositions: positions };
		}),

		updateTranslation: assign((context, event: PointerToolEvent) => {
			if (!context.dragStart) return {};

			const offset = {
				x: event.point.x - context.dragStart.x,
				y: event.point.y - context.dragStart.y,
			};

			// Apply translation to all selected shapes
			context.selectedIds.forEach((id) => {
				const initial = context.initialPositions.get(id);
				if (initial) {
					whiteboardStore.getState().updateShape(id, {
						x: initial.x + offset.x,
						y: initial.y + offset.y,
					});
				}
			});

			return { dragOffset: offset };
		}),

		commitTranslation: () => {
			// Could add to history here
			console.log("Translation committed");
		},

		cancelTranslation: (context) => {
			// Restore original positions
			context.initialPositions.forEach((pos, id) => {
				whiteboardStore.getState().updateShape(id, pos);
			});
		},

		// Brush selection actions
		startBrushSelection: assign((context, event: PointerToolEvent) => ({
			dragStart: event.point,
			selectionBox: {
				x: event.point.x,
				y: event.point.y,
				width: 0,
				height: 0,
			},
		})),

		startBrushFromSingle: assign((context) => {
			if (!context.dragStart) return {};

			return {
				selectionBox: {
					x: context.dragStart.x,
					y: context.dragStart.y,
					width: 0,
					height: 0,
				},
			};
		}),

		updateSelectionBox: assign((context, event: PointerToolEvent) => {
			if (!context.dragStart) return {};

			const box: Bounds = {
				x: Math.min(context.dragStart.x, event.point.x),
				y: Math.min(context.dragStart.y, event.point.y),
				width: Math.abs(event.point.x - context.dragStart.x),
				height: Math.abs(event.point.y - context.dragStart.y),
			};

			// Update selected shapes based on intersection
			const intersecting = getShapesInBounds(box);
			const selectedIds = new Set(intersecting);

			whiteboardStore.getState().setSelectedShapeIds(selectedIds);

			return {
				selectionBox: box,
				selectedIds,
			};
		}),

		showSelectionBox: () => {
			// UI will react to selectionBox in context
		},

		hideSelectionBox: assign({
			selectionBox: null,
		}),

		finalizeSelection: () => {
			console.log("Selection finalized");
		},

		// Crop mode actions (placeholder)
		enterCropMode: (context, event: any) => {
			console.log("Entering crop mode for shape:", event.target);
		},

		setupCropMode: () => {
			console.log("Setting up crop mode");
		},

		teardownCropMode: () => {
			console.log("Tearing down crop mode");
		},

		exitCropMode: () => {
			console.log("Exiting crop mode");
		},

		applyCrop: () => {
			console.log("Applying crop");
		},
	},

	guards: {
		isPointOnShape: (context, event: PointerToolEvent) => {
			return !!getShapeAtPoint(event.point);
		},

		isPointOnSelectedShape: (context, event: PointerToolEvent) => {
			const shapeId = getShapeAtPoint(event.point);
			return shapeId ? context.selectedIds.has(shapeId) : false;
		},

		hasSelection: (context) => {
			return context.selectedIds.size > 0;
		},

		isDragging: (context) => {
			return context.dragStart !== null;
		},
	},

	services: {
		snappingService: fromCallback(({ sendBack, receive }) => {
			// Placeholder for snapping service
			console.log("Snapping service started");

			return () => {
				console.log("Snapping service stopped");
			};
		}),
	},
});
