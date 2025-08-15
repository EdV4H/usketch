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
		const s = shape as any;
		if (
			point.x >= s.x &&
			point.x <= s.x + (s.width || 0) &&
			point.y >= s.y &&
			point.y <= s.y + (s.height || 0)
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
		const s = shape as any;
		// Check if shape intersects with selection bounds
		if (
			s.x < bounds.x + bounds.width &&
			s.x + (s.width || 0) > bounds.x &&
			s.y < bounds.y + bounds.height &&
			s.y + (s.height || 0) > bounds.y
		) {
			intersecting.push(id);
		}
	}

	return intersecting;
}

// === Select Tool State Machine ===
export const selectToolMachine = createToolMachine<SelectToolContext>({
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
		selectShape: assign((context: any, event: PointerToolEvent) => {
			const shapeId = getShapeAtPoint(event.point);
			if (!shapeId) return {};

			const newSelectedIds = new Set(context.selectedIds);

			if (event.shiftKey || event.metaKey) {
				// Multi-select
				if (newSelectedIds.has(shapeId)) {
					newSelectedIds.delete(shapeId);
				} else {
					newSelectedIds.add(shapeId);
				}
			} else {
				// Single select
				newSelectedIds.clear();
				newSelectedIds.add(shapeId);
			}

			whiteboardStore.getState().setSelectedShapeIds(newSelectedIds as Set<string>);

			return { selectedIds: newSelectedIds };
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

		deleteSelectedShapes: (context: any) => {
			context.selectedIds.forEach((id: string) => {
				whiteboardStore.getState().deleteShape(id);
			});
		},

		// Hover actions
		updateHover: assign((_context, event: PointerToolEvent) => {
			const shapeId = getShapeAtPoint(event.point);
			return {
				hoveredId: shapeId,
				cursor: shapeId ? "pointer" : "default",
			};
		}),

		// Translation actions
		startTranslating: assign((_context, event: PointerToolEvent) => ({
			dragStart: event.point,
			dragOffset: { x: 0, y: 0 },
		})),

		recordInitialPositions: assign((context: any) => {
			const positions = new Map<string, Point>();
			const state = whiteboardStore.getState();

			context.selectedIds.forEach((id: string) => {
				const shape = state.shapes[id];
				if (shape) {
					positions.set(id, { x: shape.x, y: shape.y });
				}
			});

			return { initialPositions: positions };
		}),

		updateTranslation: assign((context: any, event: PointerToolEvent) => {
			if (!context.dragStart) return {};

			const offset = {
				x: event.point.x - context.dragStart.x,
				y: event.point.y - context.dragStart.y,
			};

			// Apply translation to all selected shapes
			context.selectedIds.forEach((id: string) => {
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

		cancelTranslation: ({ context }: any) => {
			// Restore original positions
			context.initialPositions.forEach((pos: Point, id: string) => {
				whiteboardStore.getState().updateShape(id, pos);
			});
		},

		// Brush selection actions
		startBrushSelection: assign((_context, event: PointerToolEvent) => ({
			dragStart: event.point,
			selectionBox: {
				x: event.point.x,
				y: event.point.y,
				width: 0,
				height: 0,
			},
		})),

		startBrushFromSingle: assign((context: any) => {
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

		updateSelectionBox: assign((context: any, event: PointerToolEvent) => {
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
		enterCropMode: (_context: any, event: any) => {
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
		isPointOnShape: ({ event }: { event: PointerToolEvent }) => {
			return !!getShapeAtPoint(event.point);
		},

		isPointOnSelectedShape: ({
			context,
			event,
		}: {
			context: SelectToolContext;
			event: PointerToolEvent;
		}) => {
			const shapeId = getShapeAtPoint(event.point);
			return shapeId ? context.selectedIds.has(shapeId) : false;
		},

		hasSelection: ({ context }: any) => {
			return context.selectedIds.size > 0;
		},

		isDragging: ({ context }: any) => {
			return context.dragStart !== null;
		},
	},

	services: {
		snappingService: fromCallback(({ sendBack: _sendBack, receive: _receive }) => {
			// Placeholder for snapping service
			console.log("Snapping service started");

			return () => {
				console.log("Snapping service stopped");
			};
		}),
	},
});
