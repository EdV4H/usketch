import { assign, fromCallback, setup } from "xstate";
import type { Bounds, Point, ToolContext } from "../types";
import {
	commitShapeChanges,
	getCropHandleAtPoint,
	getShape,
	getShapeAtPoint,
	getShapesInBounds,
	updateShape,
} from "../utils/geometry";
import { SnapEngine } from "../utils/snapEngine";

// === Select Tool Context ===
export interface SelectToolContext extends ToolContext {
	dragStart: Point | null;
	dragOffset: Point;
	selectionBox: Bounds | null;
	initialPositions: Map<string, Point>;
	croppingShapeId?: string;
}

// === Select Tool Events ===
export type SelectToolEvent =
	| { type: "POINTER_DOWN"; point: Point; target?: string }
	| { type: "POINTER_MOVE"; point: Point }
	| { type: "POINTER_UP"; point: Point }
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
			return {
				dragStart: event.point,
				dragOffset: { x: 0, y: 0 },
			};
		}),

		selectShape: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			const shape = getShapeAtPoint(event.point);
			if (!shape) return {};

			return {
				selectedIds: new Set([shape.id]),
				hoveredId: shape.id,
			};
		}),

		startBrushSelection: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			return {
				selectionBox: {
					x: event.point.x,
					y: event.point.y,
					width: 0,
					height: 0,
				},
			};
		}),

		updateSelectionBox: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.selectionBox) return {};

			const box = {
				x: Math.min(context.selectionBox.x, event.point.x),
				y: Math.min(context.selectionBox.y, event.point.y),
				width: Math.abs(event.point.x - context.selectionBox.x),
				height: Math.abs(event.point.y - context.selectionBox.y),
			};

			const intersecting = getShapesInBounds(box);

			return {
				selectionBox: box,
				selectedIds: new Set(intersecting.map((s) => s.id)),
			};
		}),

		finalizeSelection: assign({
			selectionBox: null,
		}),

		showSelectionBox: () => {
			// TODO: Show selection box UI
		},

		hideSelectionBox: () => {
			// TODO: Hide selection box UI
		},

		recordInitialPositions: assign(({ context }) => {
			const positions = new Map<string, Point>();
			context.selectedIds.forEach((id) => {
				const shape = getShape(id);
				if (shape) {
					positions.set(id, { x: shape.x, y: shape.y });
				}
			});
			return { initialPositions: positions };
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
				if (initial) {
					updateShape(id, {
						x: initial.x + offset.x,
						y: initial.y + offset.y,
					});
				}
			});

			return { dragOffset: offset };
		}),

		commitTranslation: () => {
			commitShapeChanges();
		},

		cancelTranslation: ({ context }) => {
			// Restore original positions
			context.initialPositions.forEach((pos, id) => {
				updateShape(id, pos);
			});
		},

		clearSelection: assign({
			selectedIds: new Set<string>(),
			hoveredId: null,
		}),

		deleteSelectedShapes: ({ context }) => {
			// TODO: Implement shape deletion
			console.log("Delete shapes:", Array.from(context.selectedIds));
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

		applyCrop: ({ context }) => {
			// TODO: Apply crop to shape
			console.log("Apply crop to:", context.croppingShapeId);
		},

		showCropOverlay: () => {
			// TODO: Show crop overlay UI
		},

		hideCropOverlay: () => {
			// TODO: Hide crop overlay UI
		},

		adjustCropBounds: ({ event }) => {
			// TODO: Adjust crop bounds
			if (event.type === "POINTER_MOVE") {
				console.log("Adjust crop:", event.point);
			}
		},
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

	context: {
		dragStart: null,
		dragOffset: { x: 0, y: 0 },
		selectionBox: null,
		initialPositions: new Map(),
		cursor: "default",
		selectedIds: new Set(),
		hoveredId: null,
	},

	states: {
		idle: {
			entry: "resetCursor",
			on: {
				POINTER_DOWN: [
					{
						target: "translating",
						guard: "isPointOnSelectedShape",
						actions: "startTranslating",
					},
					{
						target: "selecting.single",
						guard: "isPointOnShape",
						actions: "selectShape",
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
