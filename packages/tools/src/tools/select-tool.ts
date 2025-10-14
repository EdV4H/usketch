import type { PointerCoordinates } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { assign, setup } from "xstate";
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
import { SnapEngine, type SnapGuide } from "../utils/snap-engine";

// Constants for snap functionality
const DEFAULT_SHAPE_SIZE = 100;
const GRID_SIZE = 20;
const SNAP_THRESHOLD = 15;

// Type for shapes that can be snapped to (with dimensions)
interface SnappableShape {
	x: number;
	y: number;
	width: number;
	height: number;
	[key: string]: any;
}

// Type guard to check if a shape has dimensions for snapping
function hasSnapDimensions(shape: { [key: string]: any }): shape is SnappableShape {
	return (
		shape &&
		typeof shape.x === "number" &&
		typeof shape.y === "number" &&
		typeof shape.width === "number" &&
		typeof shape.height === "number"
	);
}

// Create a singleton instance of SnapEngine with default values
// Increased snap calculation range from 200 to 500 for better snap detection
const DEFAULT_SNAP_CALCULATION_RANGE = 500; // Increased for better range
const DEFAULT_VIEWPORT_MARGIN = 300; // Increased for better viewport coverage
const snapEngine = new SnapEngine(
	GRID_SIZE,
	SNAP_THRESHOLD,
	DEFAULT_SNAP_CALCULATION_RANGE,
	DEFAULT_VIEWPORT_MARGIN,
);

// Export function to update snap range settings
export function updateSnapRange(snapCalculationRange?: number, viewportMargin?: number): void {
	snapEngine.updateSnapRange(snapCalculationRange, viewportMargin);
}

// Export function to get current snap range settings
export function getSnapRangeSettings(): { snapCalculationRange: number; viewportMargin: number } {
	return snapEngine.getSnapRangeSettings();
}

// Helper function to extract world coordinates from Point or PointerCoordinates
function extractWorldPoint(point: Point | PointerCoordinates): Point {
	return "world" in point ? point.world : point;
}

// === Select Tool Context ===
export interface SelectToolContext extends ToolContext {
	// Drag state (consolidated)
	dragState: {
		isDragging: boolean;
		startPoint: Point;
		currentPoint: Point;
		offset: Point;
		initialPositions: Map<string, Point>;
		initialPoints: Map<string, Point[]>; // For freedraw shapes
	} | null;
	// Selection box state
	selectionBox: Bounds | null;
	// Crop state
	croppingShapeId?: string;
	// Resize state
	resizeHandle: ResizeHandle | null;
	resizingShapeId: string | null;
	initialBounds: Bounds | null;
	// Snap guides
	snapGuides: SnapGuide[];
	// Track if pointer has moved enough to start dragging
	hasMovedEnough: boolean;
}

// === Select Tool Events ===
export type SelectToolEvent =
	| {
			type: "POINTER_DOWN";
			point: Point | PointerCoordinates;
			target?: string;
			shiftKey?: boolean;
			ctrlKey?: boolean;
			altKey?: boolean;
			metaKey?: boolean;
	  }
	| {
			type: "POINTER_MOVE";
			point: Point | PointerCoordinates;
			shiftKey?: boolean;
			ctrlKey?: boolean;
			altKey?: boolean;
			metaKey?: boolean;
	  }
	| {
			type: "POINTER_UP";
			point: Point | PointerCoordinates;
			shiftKey?: boolean;
			ctrlKey?: boolean;
			altKey?: boolean;
			metaKey?: boolean;
	  }
	| { type: "DOUBLE_CLICK"; point: Point | PointerCoordinates; target?: string }
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

		prepareForDrag: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			// Prepare drag state but don't start dragging yet
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
				dragState: {
					isDragging: false,
					startPoint: extractWorldPoint(event.point),
					currentPoint: extractWorldPoint(event.point),
					offset: { x: 0, y: 0 },
					initialPositions: positions,
					initialPoints: points,
				},
				hasMovedEnough: false,
				selectedIds: new Set(selectedIds), // Update selectedIds from store
			};
		}),

		startDragging: assign(({ context }) => {
			if (!context.dragState) {
				return {};
			}
			return {
				dragState: {
					...context.dragState,
					isDragging: true,
				},
			};
		}),

		selectShape: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			const shape = getShapeAtPoint(extractWorldPoint(event.point));

			if (!shape) return {};

			const store = whiteboardStore.getState();

			// Normal click - replace selection
			// (Shift+Click is handled separately in toggleShapeSelection)
			store.setSelection([shape.id]);
			return {
				selectedIds: new Set([shape.id]),
				hoveredId: shape.id,
			};
		}),

		toggleShapeSelection: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};

			const shape = getShapeAtPoint(extractWorldPoint(event.point));

			if (!shape) return {};

			const store = whiteboardStore.getState();
			const currentSelection = new Set(store.selectedShapeIds);

			if (currentSelection.has(shape.id)) {
				// Deselect if already selected
				currentSelection.delete(shape.id);
			} else {
				// Add to selection
				currentSelection.add(shape.id);
			}

			store.setSelection(Array.from(currentSelection));
			return {
				selectedIds: currentSelection,
				hoveredId: shape.id,
			};
		}),

		startBrushSelection: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};

			return {
				dragState: {
					isDragging: true,
					startPoint: extractWorldPoint(event.point),
					currentPoint: extractWorldPoint(event.point),
					offset: { x: 0, y: 0 },
					initialPositions: new Map(),
					initialPoints: new Map(),
				},
				selectionBox: {
					x: extractWorldPoint(event.point).x,
					y: extractWorldPoint(event.point).y,
					width: 0,
					height: 0,
				},
			};
		}),

		updateSelectionBox: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.selectionBox || !context.dragState) return {};

			// Use the fixed drag start point from drag state
			const startX = context.dragState.startPoint.x;
			const startY = context.dragState.startPoint.y;
			const currentX = extractWorldPoint(event.point).x;
			const currentY = extractWorldPoint(event.point).y;

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

			// Update store during drag for real-time selection feedback
			store.setSelection(Array.from(newSelectedIds));

			// Update selection indicator in store (visual feedback only)
			whiteboardStore.getState().setSelectionIndicator({
				bounds: box,
				visible: true,
				selectedCount: newSelectedIds.size,
			});

			return {
				selectionBox: box,
				selectedIds: newSelectedIds, // Keep track locally
			};
		}),

		finalizeSelection: assign(({ context }) => {
			// Now update the store with the final selection
			// This creates only ONE History entry instead of many
			if (context.selectedIds && context.selectedIds.size >= 0) {
				whiteboardStore.getState().setSelection(Array.from(context.selectedIds));
			}

			// Update Zustand store directly
			whiteboardStore.getState().hideSelectionIndicator();

			return {
				selectionBox: null,
				dragState: null,
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

		checkMovementThreshold: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.dragState) return {};

			const dx = extractWorldPoint(event.point).x - context.dragState.startPoint.x;
			const dy = extractWorldPoint(event.point).y - context.dragState.startPoint.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Check if moved enough to start dragging (3 pixels threshold)
			if (distance > 3) {
				return {
					hasMovedEnough: true,
					dragState: {
						...context.dragState,
						currentPoint: extractWorldPoint(event.point),
					},
				};
			}
			return {};
		}),

		updateTranslation: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.dragState || !context.dragState.isDragging)
				return {};

			// Check if Alt key is pressed to disable snapping
			const isAltPressed = event.altKey || false;

			const offset = {
				x: extractWorldPoint(event.point).x - context.dragState.startPoint.x,
				y: extractWorldPoint(event.point).y - context.dragState.startPoint.y,
			};

			// Get the first shape position for snapping
			const selectedShapeIds =
				context.selectedIds && context.selectedIds.size > 0
					? context.selectedIds
					: whiteboardStore.getState().selectedShapeIds;
			const firstShapeId = Array.from(selectedShapeIds)[0];
			const firstInitial = firstShapeId
				? context.dragState.initialPositions.get(firstShapeId)
				: null;
			const firstShape = firstShapeId ? getShape(firstShapeId) : null;

			let finalOffset = offset;
			let guides: SnapGuide[] = [];

			if (firstInitial && firstShape && !isAltPressed) {
				// Calculate the new position
				const newPosition = {
					x: firstInitial.x + offset.x,
					y: firstInitial.y + offset.y,
				};

				// Get all shapes that are not being dragged for shape-to-shape snapping
				const store = whiteboardStore.getState();
				const allShapes = Object.values(store.shapes);

				// Index shapes for efficient spatial queries
				const allSnappableShapes: SnappableShape[] = [];
				for (const shape of allShapes) {
					if (hasSnapDimensions(shape)) {
						allSnappableShapes.push(shape);
					}
				}

				// Initialize spatial index if we have many shapes
				if (allSnappableShapes.length > 50) {
					snapEngine.indexShapes(allSnappableShapes);
				}

				// Set viewport for culling
				const camera = store.camera;
				if (camera && typeof window !== "undefined") {
					snapEngine.setViewport({
						x: -camera.x / camera.zoom,
						y: -camera.y / camera.zoom,
						width: window.innerWidth / camera.zoom,
						height: window.innerHeight / camera.zoom,
					});
				}

				// Filter out selected shapes
				const targetShapes: SnappableShape[] = [];
				for (const shape of allSnappableShapes) {
					if (!selectedShapeIds.has(shape.id)) {
						targetShapes.push(shape);
					}
				}

				// First try shape-to-shape snapping
				let snappedPosition = newPosition;
				let snapped = false;
				const { snapSettings } = store;

				if (targetShapes.length > 0 && snapSettings.shapeSnap && snapSettings.enabled) {
					// Calculate moving shape bounds
					const movingShape = {
						x: newPosition.x,
						y: newPosition.y,
						width: "width" in firstShape ? firstShape.width : DEFAULT_SHAPE_SIZE,
						height: "height" in firstShape ? firstShape.height : DEFAULT_SHAPE_SIZE,
					};

					// Pass filtered shapes with dimensions to snap engine
					// targetShapes is already type-checked by hasSnapDimensions guard
					const shapeSnapResult = snapEngine.snapToShapes(movingShape, targetShapes, newPosition);

					if (shapeSnapResult.snapped) {
						snappedPosition = shapeSnapResult.position;
						guides = shapeSnapResult.guides || [];
						snapped = true;
					}

					// Generate smart guides when enabled and moving near other shapes
					if (
						snapSettings.showGuides ||
						snapSettings.showAlignmentGuides ||
						snapSettings.showDistances
					) {
						// Use snapped position for smart guides to show guides at the actual shape position
						const shapeForGuides = {
							x: snappedPosition.x,
							y: snappedPosition.y,
							width: "width" in firstShape ? firstShape.width : DEFAULT_SHAPE_SIZE,
							height: "height" in firstShape ? firstShape.height : DEFAULT_SHAPE_SIZE,
						};

						// Gather all selected shapes for group alignment
						const selectedShapeBounds: Array<{
							x: number;
							y: number;
							width: number;
							height: number;
						}> = [];

						// Calculate the final offset based on the snapped position
						const snappedOffset = {
							x: snappedPosition.x - firstInitial.x,
							y: snappedPosition.y - firstInitial.y,
						};

						selectedShapeIds.forEach((id) => {
							const shape = getShape(id);
							const initialPos = context.dragState?.initialPositions.get(id);
							if (shape && hasSnapDimensions(shape) && initialPos) {
								// Use snapped offset for all shapes in the group
								selectedShapeBounds.push({
									x: initialPos.x + snappedOffset.x,
									y: initialPos.y + snappedOffset.y,
									width: shape.width,
									height: shape.height,
								});
							}
						});

						const smartGuides = snapEngine.generateSmartGuides(
							shapeForGuides,
							targetShapes,
							selectedShapeBounds.length > 1 ? selectedShapeBounds : undefined,
							extractWorldPoint(event.point), // Pass mouse position for distance guides
							snapSettings.showDistances, // Enable threshold visualization if distances are shown
							snapSettings.showEqualSpacing, // Enable equal spacing detection
						);
						// Filter guides based on settings
						const filteredSmartGuides = smartGuides.filter((g) => {
							// Filter distance guides based on their purpose
							if (g.type === "distance") {
								// Equal spacing guides have isEqualSpacing flag
								if (g.isEqualSpacing) {
									return snapSettings.showEqualSpacing;
								}
								// Regular distance guides are controlled by showDistances
								return snapSettings.showDistances;
							}
							// Filter alignment guides (solid lines) based on showAlignmentGuides setting
							if (g.style === "solid") {
								return snapSettings.showAlignmentGuides;
							}
							// Other guides (dashed) controlled by showGuides
							return snapSettings.showGuides;
						});
						guides = [...guides, ...filteredSmartGuides];
					}
				}

				// If no shape snapping occurred, try grid snapping
				if (!snapped && snapSettings.gridSnap && snapSettings.enabled) {
					// Update snap engine settings
					snapEngine.setGridSize(snapSettings.gridSize);
					snapEngine.setSnapThreshold(snapSettings.snapThreshold || SNAP_THRESHOLD);

					const gridSnapResult = snapEngine.snap(snappedPosition, {
						snapEnabled: snapSettings.enabled,
						gridSnap: snapSettings.gridSnap,
						gridSize: snapSettings.gridSize,
						snapThreshold: snapSettings.snapThreshold,
					});

					if (gridSnapResult.snapped) {
						snappedPosition = gridSnapResult.position;
						snapped = true;

						// Generate grid snap guides if showGuides is enabled
						if (snapSettings.showGuides) {
							if (snappedPosition.x !== newPosition.x) {
								guides.push({
									type: "vertical",
									position: snappedPosition.x,
									start: { x: snappedPosition.x, y: -10000 },
									end: { x: snappedPosition.x, y: 10000 },
								});
							}
							if (snappedPosition.y !== newPosition.y) {
								guides.push({
									type: "horizontal",
									position: snappedPosition.y,
									start: { x: -10000, y: snappedPosition.y },
									end: { x: 10000, y: snappedPosition.y },
								});
							}
						}
					}
				}

				// Update offset based on final snapped position
				finalOffset = {
					x: snappedPosition.x - firstInitial.x,
					y: snappedPosition.y - firstInitial.y,
				};
			}

			// Apply translation to all selected shapes
			const batchUpdates: Array<{ id: string; updates: any }> = [];
			selectedShapeIds.forEach((id) => {
				const initial = context.dragState?.initialPositions.get(id);
				const shape = getShape(id);
				if (initial && shape) {
					// Update position for all shapes
					const updates: any = {
						x: initial.x + finalOffset.x,
						y: initial.y + finalOffset.y,
					};

					// For freedraw shapes, also update points
					if (shape.type === "freedraw" && (shape as any).points) {
						const initialPoints = context.dragState?.initialPoints.get(id);
						if (initialPoints) {
							updates.points = initialPoints.map((p: Point) => ({
								x: p.x + finalOffset.x,
								y: p.y + finalOffset.y,
							}));
						}
					}

					batchUpdates.push({ id, updates });
				}
			});

			// Use batch update if multiple shapes, single update otherwise
			if (batchUpdates.length > 1) {
				const { batchUpdateShapes } = whiteboardStore.getState();
				if (batchUpdateShapes) {
					batchUpdateShapes(batchUpdates);
				} else {
					// Fallback to individual updates
					batchUpdates.forEach(({ id, updates }) => {
						updateShape(id, updates);
					});
				}
			} else if (batchUpdates.length === 1) {
				updateShape(batchUpdates[0].id, batchUpdates[0].updates);
			}

			// Update snap guides in store (only if any guide type is enabled)
			const { snapSettings } = whiteboardStore.getState();
			if (
				snapSettings.showGuides ||
				snapSettings.showAlignmentGuides ||
				snapSettings.showDistances
			) {
				whiteboardStore.getState().setSnapGuides(guides);
			} else {
				whiteboardStore.getState().setSnapGuides([]);
			}

			return {
				dragState: {
					...context.dragState,
					offset: finalOffset,
					currentPoint: extractWorldPoint(event.point),
				},
				snapGuides: guides,
			};
		}),

		commitTranslation: () => {
			commitShapeChanges();
			// Clear snap guides when dragging ends
			whiteboardStore.getState().setSnapGuides([]);
		},

		cancelTranslation: assign(({ context }) => {
			if (!context.dragState) return {};

			// Restore original positions for all shapes
			const selectedShapeIds =
				context.selectedIds && context.selectedIds.size > 0
					? context.selectedIds
					: whiteboardStore.getState().selectedShapeIds;

			const batchUpdates: Array<{ id: string; updates: any }> = [];
			selectedShapeIds.forEach((id) => {
				const originalPos = context.dragState?.initialPositions.get(id);
				const shape = getShape(id);
				if (originalPos && shape) {
					const updates: any = { ...originalPos };

					// For freedraw shapes, restore original points
					if (shape.type === "freedraw") {
						const originalPoints = context.dragState?.initialPoints.get(id);
						if (originalPoints) {
							updates.points = originalPoints;
						}
					}

					batchUpdates.push({ id, updates });
				}
			});

			// Use batch update if multiple shapes, single update otherwise
			if (batchUpdates.length > 1) {
				const { batchUpdateShapes } = whiteboardStore.getState();
				if (batchUpdateShapes) {
					batchUpdateShapes(batchUpdates);
				} else {
					// Fallback to individual updates
					batchUpdates.forEach(({ id, updates }) => {
						updateShape(id, updates);
					});
				}
			} else if (batchUpdates.length === 1) {
				updateShape(batchUpdates[0].id, batchUpdates[0].updates);
			}
			// Clear snap guides when dragging is cancelled
			whiteboardStore.getState().setSnapGuides([]);
			return {
				dragState: null,
			};
		}),

		clearSelection: assign(() => {
			// Update Zustand store directly
			whiteboardStore.getState().hideSelectionIndicator();
			whiteboardStore.getState().clearSelection();

			return {
				selectedIds: new Set<string>(),
				hoveredId: null,
				selectionBox: null,
				dragState: null,
			};
		}),

		deleteSelectedShapes: () => {
			// TODO: Implement shape deletion
		},

		enterCropMode: assign(({ event }) => {
			if (event.type !== "DOUBLE_CLICK") return {};
			const shape = getShapeAtPoint(extractWorldPoint(event.point));
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

			// Check if we have a resize handle from event (set by SelectionLayer)
			// or fall back to point-based detection
			const handle =
				(event as any).resizeHandle ||
				getResizeHandleAtPoint(extractWorldPoint(event.point), shapeId);
			if (!handle) return {};

			return {
				resizeHandle: handle as ResizeHandle,
				resizingShapeId: shapeId,
				dragState: {
					isDragging: false,
					startPoint: extractWorldPoint(event.point),
					currentPoint: extractWorldPoint(event.point),
					offset: { x: 0, y: 0 },
					initialPositions: new Map(),
					initialPoints: new Map(),
				},
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
				!context.dragState ||
				!context.initialBounds
			) {
				return {};
			}

			const delta = {
				x: extractWorldPoint(event.point).x - context.dragState.startPoint.x,
				y: extractWorldPoint(event.point).y - context.dragState.startPoint.y,
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
				dragState: null,
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
		isShiftClick: ({ event }) => {
			if (event.type !== "POINTER_DOWN") return false;
			return event.shiftKey === true;
		},

		isPointOnShape: ({ event }) => {
			if (!("point" in event)) return false;
			const shape = getShapeAtPoint(extractWorldPoint(event.point)!);
			return !!shape;
		},

		isPointOnSelectedShape: ({ event }) => {
			if (!("point" in event)) return false;
			const shape = getShapeAtPoint(extractWorldPoint(event.point)!);
			// Use Zustand store for selected IDs instead of context
			const store = whiteboardStore.getState();
			const result = shape ? store.selectedShapeIds.has(shape.id) : false;
			return result;
		},

		hasMovedEnough: ({ context, event }) => {
			// Check if already marked as moved enough
			if (context.hasMovedEnough === true) return true;

			// Or check distance directly from event
			if (event.type === "POINTER_MOVE" && context.dragState) {
				const dx = extractWorldPoint(event.point).x - context.dragState.startPoint.x;
				const dy = extractWorldPoint(event.point).y - context.dragState.startPoint.y;
				const distance = Math.sqrt(dx * dx + dy * dy);
				return distance > 3;
			}

			return false;
		},

		isPointOnCropHandle: ({ event }) => {
			if (!("point" in event)) return false;
			return !!getCropHandleAtPoint(extractWorldPoint(event.point)!);
		},

		isPointOnResizeHandle: ({ event }) => {
			if (event.type !== "POINTER_DOWN") return false;

			// Check if we have a resize handle identifier from DOM (data-resize-handle attribute)
			// The target field contains shapeId, not resize handle, so we need a separate field
			const resizeHandle = (event as any).resizeHandle;

			if (resizeHandle && typeof resizeHandle === "string" && resizeHandle.length <= 2) {
				// Valid resize handles are: "nw", "n", "ne", "e", "se", "s", "sw", "w"
				return true;
			}

			// Fallback to point-based detection
			const store = whiteboardStore.getState();
			const selectedIds = store.selectedShapeIds;
			if (selectedIds.size !== 1) return false;

			const shapeId = Array.from(selectedIds)[0];
			const handle = getResizeHandleAtPoint(extractWorldPoint(event.point), shapeId);
			return !!handle;
		},
	},
}).createMachine({
	id: "selectTool",
	initial: "idle",

	context: {
		dragState: null,
		selectionBox: null,
		cursor: "default",
		selectedIds: new Set(),
		hoveredId: null,
		resizeHandle: null,
		resizingShapeId: null,
		initialBounds: null,
		snapGuides: [],
		hasMovedEnough: false,
	},

	states: {
		idle: {
			entry: "resetCursor",
			on: {
				POINTER_DOWN: [
					{
						// Shift+Click on shape - toggle selection (check this BEFORE resize handle)
						target: "idle",
						guard: ({ event }) => {
							return event.shiftKey === true && !!getShapeAtPoint(extractWorldPoint(event.point));
						},
						actions: "toggleShapeSelection",
					},
					{
						// Check for resize handle
						target: "resizing",
						guard: "isPointOnResizeHandle",
						actions: "startResize",
					},
					{
						// Click on selected shape - prepare for drag
						// (but not on Shift+Click, which is handled above)
						target: "readyToDrag",
						guard: ({ event }) => {
							if (event.type !== "POINTER_DOWN") return false;
							if (event.shiftKey) return false; // Exclude Shift+Click
							const shape = getShapeAtPoint(extractWorldPoint(event.point));
							const store = whiteboardStore.getState();
							return shape ? store.selectedShapeIds.has(shape.id) : false;
						},
						actions: "prepareForDrag",
					},
					{
						// Click on unselected shape - select and prepare for drag
						// (but not on Shift+Click, which is handled above)
						target: "readyToDrag",
						guard: ({ event }) => {
							return !event.shiftKey && !!getShapeAtPoint(extractWorldPoint(event.point));
						},
						actions: ["selectShape", "prepareForDrag"],
					},
					{
						// Click on empty space - clear selection and start brush selection
						target: "selecting.brush",
						actions: ["clearSelection", "startBrushSelection"],
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

		// === 準備状態: ドラッグ前の準備 ===
		readyToDrag: {
			on: {
				POINTER_MOVE: [
					{
						// Transition to translating if hasMovedEnough
						target: "translating",
						guard: "hasMovedEnough",
						actions: ["checkMovementThreshold", "startDragging"],
					},
					{
						// Otherwise just check movement threshold
						actions: "checkMovementThreshold",
					},
				],
				POINTER_UP: {
					target: "idle",
				},
				ESCAPE: {
					target: "idle",
					actions: "clearSelection",
				},
			},
		},

		// === ドラッグ状態 ===
		translating: {
			entry: "setCursorMove",
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
	// Machine will sync with store on actions
	return selectToolMachine;
}
