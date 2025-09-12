import { whiteboardStore } from "@usketch/store";
import { assign, fromCallback, setup } from "xstate";
import type { Bounds, Point, ToolContext } from "../types/index";
import {
	commitShapeChanges,
	getCropHandleAtPoint,
	getResizeHandleAtPoint,
	getShape,
	getShapeAtPoint,
	getShapesInBounds,
	type ResizeHandle,
	updateShape,
} from "../utils/geometry";
import { calculateNewBounds } from "../utils/resize-calculator";
import { SnapEngine } from "../utils/snap-engine";

// === Select Tool Context ===
export interface SelectToolContext extends ToolContext {
	dragStart: Point | null;
	dragOffset: Point;
	selectionBox: Bounds | null;
	initialPositions: Map<string, Point>;
	initialPoints: Map<string, Point[]>; // Store original points for freedraw shapes
	croppingShapeId?: string;
	// Resize state
	resizeHandle: ResizeHandle | null;
	resizingShapeId: string | null;
	initialBounds: Bounds | null;
}

// === Select Tool Events ===
export type SelectToolEvent =
	| {
			type: "POINTER_DOWN";
			point: Point;
			target?: string;
			shiftKey?: boolean;
			ctrlKey?: boolean;
			metaKey?: boolean;
	  }
	| { type: "POINTER_MOVE"; point: Point; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
	| { type: "POINTER_UP"; point: Point; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
	| { type: "DOUBLE_CLICK"; point: Point; target?: string }
	| { type: "KEY_DOWN"; key: string }
	| { type: "ESCAPE" }
	| { type: "DELETE" }
	| { type: "ENTER" }
	| { type: "ENTER_CROP_MODE"; shapeId: string };

// === Select Tool Machine (XState v5) ===
export const selectToolMachine = setup({
	types: {
		context: {} as SelectToolContext,
		events: {} as SelectToolEvent,
	},
	actions: {
		resetCursor: assign({
			cursor: "default",
		}),

		setCursorMove: assign({
			cursor: "move",
		}),

		startTranslating: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			// Use store's selection which has been updated by the adapter
			const store = whiteboardStore.getState();
			const selectedIds = store.selectedShapeIds;

			// Record initial positions and points of all selected shapes
			const positions = new Map<string, Point>();
			const points = new Map<string, Point[]>();

			selectedIds.forEach((id) => {
				const shape = getShape(id);
				if (shape) {
					positions.set(id, { x: shape.x, y: shape.y });
					// For freedraw shapes, store initial points
					if (shape.type === "freedraw" && (shape as any).points) {
						points.set(id, [...(shape as any).points]);
					}
				}
			});
			return {
				dragStart: event.point,
				dragOffset: { x: 0, y: 0 },
				initialPositions: positions,
				initialPoints: points,
				selectedIds: new Set(selectedIds), // Update machine's selection state
			};
		}),

		selectShape: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			const shape = getShapeAtPoint(event.point);
			if (!shape) return {};

			// The adapter will update the store selection
			// Sync with store's selection
			const store = whiteboardStore.getState();

			return {
				selectedIds: new Set(store.selectedShapeIds),
				hoveredId: shape.id,
			};
		}),

		startBrushSelection: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};

			// Store the drag start point separately from selection box
			// This ensures the start point is fixed during drag
			return {
				dragStart: event.point,
				selectionBox: {
					x: event.point.x,
					y: event.point.y,
					width: 0,
					height: 0,
				},
			};
		}),

		updateSelectionBox: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.selectionBox || !context.dragStart) return {};

			// Use the fixed drag start point, not the selection box position
			const startX = context.dragStart.x;
			const startY = context.dragStart.y;
			const currentX = event.point.x;
			const currentY = event.point.y;

			// Calculate the box with proper min/max to handle all drag directions
			const box = {
				x: Math.min(startX, currentX),
				y: Math.min(startY, currentY),
				width: Math.abs(currentX - startX),
				height: Math.abs(currentY - startY),
			};

			// Get shapes that intersect with the selection box
			const intersecting = getShapesInBounds(box);

			// Check if Shift is held for additive selection
			const store = whiteboardStore.getState();
			let newSelectedIds: Set<string>;

			if (event.shiftKey) {
				// Add to existing selection
				newSelectedIds = new Set(store.selectedShapeIds);
				intersecting.forEach((shape) => {
					newSelectedIds.add(shape.id);
				});
			} else {
				// Replace selection
				newSelectedIds = new Set(intersecting.map((s) => s.id));
			}

			// Update store with new selection
			store.setSelection(Array.from(newSelectedIds));

			// Update selection indicator in store
			whiteboardStore.getState().setSelectionIndicator({
				bounds: box,
				visible: true,
				selectedCount: newSelectedIds.size,
			});

			return {
				selectionBox: box,
				selectedIds: newSelectedIds,
			};
		}),

		finalizeSelection: assign(() => {
			// Update Zustand store directly
			whiteboardStore.getState().hideSelectionIndicator();

			return {
				selectionBox: null,
				dragStart: null,
			};
		}),

		showSelectionBox: () => {
			// Update Zustand store directly
			whiteboardStore.getState().showSelectionIndicator();
		},

		hideSelectionBox: () => {
			// Update Zustand store directly
			whiteboardStore.getState().hideSelectionIndicator();
		},

		recordInitialPositions: assign(({ context }) => {
			const positions = new Map<string, Point>();
			const points = new Map<string, Point[]>();

			context.selectedIds.forEach((id) => {
				const shape = getShape(id);
				if (shape) {
					positions.set(id, { x: shape.x, y: shape.y });
					// For freedraw shapes, store initial points
					if (shape.type === "freedraw" && (shape as any).points) {
						points.set(id, [...(shape as any).points]);
					}
				}
			});
			return {
				initialPositions: positions,
				initialPoints: points,
			};
		}),

		updateTranslation: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.dragStart) return {};

			const offset = {
				x: event.point.x - context.dragStart.x,
				y: event.point.y - context.dragStart.y,
			};

			// Apply translation to all selected shapes
			context.selectedIds.forEach((id) => {
				const initial = context.initialPositions.get(id);
				const shape = getShape(id);
				if (initial && shape) {
					// Update position for all shapes
					const updates: any = {
						x: initial.x + offset.x,
						y: initial.y + offset.y,
					};

					// For freedraw shapes, also update points
					if (shape.type === "freedraw" && (shape as any).points) {
						const initialPoints = context.initialPoints.get(id);
						if (initialPoints) {
							updates.points = initialPoints.map((p: Point) => ({
								x: p.x + offset.x,
								y: p.y + offset.y,
							}));
						}
					}

					updateShape(id, updates);
				}
			});

			return { dragOffset: offset };
		}),

		commitTranslation: () => {
			commitShapeChanges();
		},

		cancelTranslation: ({ context }) => {
			// Restore original positions for all shapes
			context.selectedIds.forEach((id) => {
				const originalPos = context.initialPositions.get(id);
				const shape = getShape(id);
				if (originalPos && shape) {
					const updates: any = { ...originalPos };

					// For freedraw shapes, restore original points
					if (shape.type === "freedraw") {
						const originalPoints = context.initialPoints.get(id);
						if (originalPoints) {
							updates.points = originalPoints;
						}
					}

					updateShape(id, updates);
				}
			});
		},

		clearSelection: assign(() => {
			// Update Zustand store directly
			whiteboardStore.getState().hideSelectionIndicator();

			return {
				selectedIds: new Set<string>(),
				hoveredId: null,
				selectionBox: null,
				dragStart: null,
			};
		}),

		deleteSelectedShapes: () => {
			// TODO: Implement shape deletion
		},

		enterCropMode: assign(({ event }) => {
			if (event.type !== "DOUBLE_CLICK") return {};
			const shape = getShapeAtPoint(event.point);
			if (!shape) return {};

			return {
				croppingShapeId: shape.id,
			};
		}),

		exitCropMode: assign({
			croppingShapeId: undefined,
		}),

		applyCrop: () => {
			// TODO: Apply crop to shape
		},

		showCropOverlay: () => {
			// TODO: Show crop overlay UI
		},

		hideCropOverlay: () => {
			// TODO: Hide crop overlay UI
		},

		adjustCropBounds: () => {
			// TODO: Adjust crop bounds
		},

		// Resize actions
		startResize: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};

			// Get the selected shape from store
			const store = whiteboardStore.getState();
			const selectedIds = store.selectedShapeIds;
			if (selectedIds.size !== 1) return {};

			const shapeId = Array.from(selectedIds)[0];
			const shape = getShape(shapeId);
			if (!shape || !("width" in shape && "height" in shape)) return {};

			// Check if we have a resize handle from event target
			// This is set by the DOM data-resize-handle attribute
			const handle = event.target || getResizeHandleAtPoint(event.point, shapeId);
			if (!handle) return {};

			return {
				resizeHandle: handle as ResizeHandle,
				resizingShapeId: shapeId,
				dragStart: event.point,
				initialBounds: {
					x: shape.x,
					y: shape.y,
					width: shape.width,
					height: shape.height,
				},
				selectedIds: new Set(selectedIds), // Sync selected IDs
			};
		}),

		updateResize: assign(({ context, event }) => {
			if (
				event.type !== "POINTER_MOVE" ||
				!context.resizeHandle ||
				!context.resizingShapeId ||
				!context.dragStart ||
				!context.initialBounds
			) {
				return {};
			}

			const delta = {
				x: event.point.x - context.dragStart.x,
				y: event.point.y - context.dragStart.y,
			};

			const newBounds = calculateNewBounds(
				context.initialBounds,
				context.resizeHandle,
				delta,
				event.shiftKey, // Maintain aspect ratio if shift is held
			);

			// Update the shape with new bounds
			updateShape(context.resizingShapeId, newBounds);

			return {};
		}),

		commitResize: () => {
			commitShapeChanges();
		},

		cancelResize: assign(({ context }) => {
			// Restore original bounds
			if (context.resizingShapeId && context.initialBounds) {
				updateShape(context.resizingShapeId, context.initialBounds);
			}
			return {
				resizeHandle: null,
				resizingShapeId: null,
				initialBounds: null,
				dragStart: null,
			};
		}),

		setCursorResize: assign(({ context }) => {
			if (!context.resizeHandle) return { cursor: "default" };

			// Set cursor based on handle
			const cursors: Record<string, string> = {
				nw: "nw-resize",
				n: "n-resize",
				ne: "ne-resize",
				e: "e-resize",
				se: "se-resize",
				s: "s-resize",
				sw: "sw-resize",
				w: "w-resize",
			};

			return { cursor: cursors[context.resizeHandle] || "default" };
		}),
	},
	guards: {
		isPointOnShape: ({ event }) => {
			if (!("point" in event)) return false;
			return !!getShapeAtPoint(event.point!);
		},

		isPointOnSelectedShape: ({ context, event }) => {
			if (!("point" in event)) return false;
			const shape = getShapeAtPoint(event.point!);
			return shape ? context.selectedIds.has(shape.id) : false;
		},

		isPointOnCropHandle: ({ event }) => {
			if (!("point" in event)) return false;
			return !!getCropHandleAtPoint(event.point!);
		},

		isPointOnResizeHandle: ({ event }) => {
			if (event.type !== "POINTER_DOWN") return false;

			// First check if we have a target from DOM (data-resize-handle attribute)
			if (event.target) {
				return true;
			}

			// Fallback to point-based detection
			const store = whiteboardStore.getState();
			const selectedIds = store.selectedShapeIds;
			if (selectedIds.size !== 1) return false;

			const shapeId = Array.from(selectedIds)[0];
			const handle = getResizeHandleAtPoint(event.point, shapeId);
			return !!handle;
		},
	},
	actors: {
		snappingService: fromCallback(({ sendBack, receive }) => {
			const snapEngine = new SnapEngine();

			receive((event: any) => {
				if (event.type === "UPDATE_POSITION") {
					const snapped = snapEngine.snap(event.position);
					sendBack({ type: "SNAPPED", position: snapped });
				}
			});

			return () => {
				snapEngine.cleanup();
			};
		}),
	},
}).createMachine({
	id: "selectTool",
	initial: "idle",

	context: {
		dragStart: null,
		dragOffset: { x: 0, y: 0 },
		selectionBox: null,
		initialPositions: new Map(),
		initialPoints: new Map(),
		cursor: "default",
		selectedIds: new Set(),
		hoveredId: null,
		resizeHandle: null,
		resizingShapeId: null,
		initialBounds: null,
	},

	states: {
		idle: {
			entry: "resetCursor",
			on: {
				POINTER_DOWN: [
					{
						// Check for resize handle first
						target: "resizing",
						guard: "isPointOnResizeHandle",
						actions: "startResize",
					},
					{
						target: "translating",
						guard: "isPointOnSelectedShape",
						actions: "startTranslating",
					},
					{
						// Allow direct drag of unselected shapes
						target: "translating",
						guard: "isPointOnShape",
						actions: ["selectShape", "startTranslating"],
					},
					{
						target: "selecting.brush",
						actions: "startBrushSelection",
					},
				],

				DOUBLE_CLICK: {
					target: "cropping",
					guard: "isPointOnShape",
					actions: "enterCropMode",
				},

				DELETE: {
					actions: "deleteSelectedShapes",
				},
			},
		},

		// === 階層的状態: 選択モード ===
		selecting: {
			initial: "single",

			states: {
				single: {
					on: {
						POINTER_UP: {
							target: "#selectTool.idle",
						},
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

		// === ドラッグ状態 ===
		translating: {
			entry: ["setCursorMove"],
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

			// === v5: Invoke Actor for snapping ===
			invoke: {
				id: "snappingService",
				src: "snappingService",
				input: ({ context }) => ({
					shapes: context.selectedIds,
					threshold: 10,
				}),
			},
		},

		// === リサイズ状態 ===
		resizing: {
			entry: ["setCursorResize"],
			exit: "commitResize",

			on: {
				POINTER_MOVE: {
					actions: "updateResize",
				},
				POINTER_UP: {
					target: "idle",
				},
				ESCAPE: {
					target: "idle",
					actions: "cancelResize",
				},
			},
		},

		// === 並列状態: Crop Mode ===
		cropping: {
			type: "parallel",

			states: {
				crop: {
					initial: "idle",

					states: {
						idle: {
							on: {
								POINTER_DOWN: {
									target: "adjusting",
									guard: "isPointOnCropHandle",
								},
							},
						},

						adjusting: {
							on: {
								POINTER_MOVE: {
									actions: "adjustCropBounds",
								},
								POINTER_UP: {
									target: "idle",
								},
							},
						},
					},
				},

				overlay: {
					initial: "visible",

					states: {
						visible: {
							entry: "showCropOverlay",
						},
						hidden: {
							entry: "hideCropOverlay",
						},
					},
				},
			},

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
});

export function createSelectTool() {
	return selectToolMachine;
}
