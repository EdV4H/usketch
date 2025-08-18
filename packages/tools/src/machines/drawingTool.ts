import { assign, fromCallback, setup } from "xstate";
import type { Point, ToolContext } from "../types";
import { createShape, smoothPath } from "../utils/geometry";

// === Drawing Tool Context ===
export interface DrawingToolContext extends ToolContext {
	currentStroke: Point[];
	strokeStyle: {
		color: string;
		width: number;
		opacity: number;
	};
	isDrawing: boolean;
	pressure: number;
}

// === Drawing Tool Events ===
export type DrawingToolEvent =
	| { type: "POINTER_DOWN"; point: Point }
	| { type: "POINTER_MOVE"; point: Point }
	| { type: "POINTER_UP"; point: Point }
	| { type: "PRESSURE_CHANGE"; pressure: number }
	| { type: "SET_COLOR"; color: string }
	| { type: "SET_WIDTH"; width: number }
	| { type: "SET_OPACITY"; opacity: number }
	| { type: "TOGGLE_STRAIGHT" }
	| { type: "TOGGLE_SMOOTH" }
	| { type: "TOGGLE_FREEHAND" }
	| { type: "ESCAPE" }
	| { type: "SMOOTH_TICK" };

// === Drawing Tool Machine (XState v5) ===
export const drawingToolMachine = setup({
	types: {
		context: {} as DrawingToolContext,
		events: {} as DrawingToolEvent,
	},
	actions: {
		startStroke: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			return {
				currentStroke: [event.point],
				cursor: "crosshair",
				isDrawing: true,
			};
		}),

		addPoint: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE") return {};
			return {
				currentStroke: [...context.currentStroke, event.point],
			};
		}),

		addSmoothPoint: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE") return {};
			// Apply smoothing algorithm
			const smoothed = smoothPath([...context.currentStroke, event.point], 0.5);
			return { currentStroke: smoothed };
		}),

		updateStraightLine: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || context.currentStroke.length === 0) return {};

			// Keep only first and current point for straight line
			return {
				currentStroke: [context.currentStroke[0], event.point],
			};
		}),

		finalizeStroke: ({ context }) => {
			if (context.currentStroke.length > 1) {
				createShape({
					type: "path",
					points: context.currentStroke,
					style: context.strokeStyle,
				});
			}
		},

		cancelStroke: assign({
			currentStroke: [],
			isDrawing: false,
		}),

		resetStroke: assign({
			currentStroke: [],
			cursor: "crosshair",
			isDrawing: false,
		}),

		setDrawingState: assign({
			isDrawing: true,
		}),

		clearDrawingState: assign({
			isDrawing: false,
		}),

		updatePressure: assign(({ event }) => {
			if (event.type !== "PRESSURE_CHANGE") return {};
			return {
				pressure: event.pressure,
			};
		}),

		updateColor: assign(({ context, event }) => {
			if (event.type !== "SET_COLOR") return {};
			return {
				strokeStyle: {
					...context.strokeStyle,
					color: event.color,
				},
			};
		}),

		updateWidth: assign(({ context, event }) => {
			if (event.type !== "SET_WIDTH") return {};
			return {
				strokeStyle: {
					...context.strokeStyle,
					width: event.width,
				},
			};
		}),

		updateOpacity: assign(({ context, event }) => {
			if (event.type !== "SET_OPACITY") return {};
			return {
				strokeStyle: {
					...context.strokeStyle,
					opacity: event.opacity,
				},
			};
		}),
	},
	actors: {
		smoothingService: fromCallback(({ sendBack }) => {
			const interval = setInterval(() => {
				sendBack({ type: "SMOOTH_TICK" });
			}, 16); // 60fps

			return () => clearInterval(interval);
		}),
	},
}).createMachine({
	id: "drawingTool",
	initial: "idle",

	context: {
		currentStroke: [],
		strokeStyle: {
			color: "#000000",
			width: 2,
			opacity: 1,
		},
		isDrawing: false,
		pressure: 1,
		cursor: "crosshair",
		selectedIds: new Set(),
		hoveredId: null,
	},

	states: {
		idle: {
			entry: "resetStroke",
			on: {
				POINTER_DOWN: {
					target: "drawing",
					actions: "startStroke",
				},

				// Style changes
				SET_COLOR: {
					actions: "updateColor",
				},
				SET_WIDTH: {
					actions: "updateWidth",
				},
				SET_OPACITY: {
					actions: "updateOpacity",
				},
			},
		},

		drawing: {
			entry: "setDrawingState",
			exit: "clearDrawingState",

			// === Nested states for drawing modes ===
			initial: "freehand",

			states: {
				freehand: {
					on: {
						POINTER_MOVE: {
							actions: "addPoint",
						},
					},
				},

				straight: {
					on: {
						POINTER_MOVE: {
							actions: "updateStraightLine",
						},
					},
				},

				smooth: {
					invoke: {
						id: "smoothingService",
						src: "smoothingService",
					},
					on: {
						POINTER_MOVE: {
							actions: "addSmoothPoint",
						},
						SMOOTH_TICK: {
							// Handle smooth tick if needed
						},
					},
				},
			},

			on: {
				POINTER_UP: {
					target: "idle",
					actions: "finalizeStroke",
				},

				PRESSURE_CHANGE: {
					actions: "updatePressure",
				},

				// Mode switches
				TOGGLE_STRAIGHT: ".straight",
				TOGGLE_SMOOTH: ".smooth",
				TOGGLE_FREEHAND: ".freehand",

				ESCAPE: {
					target: "idle",
					actions: "cancelStroke",
				},
			},
		},
	},
});
