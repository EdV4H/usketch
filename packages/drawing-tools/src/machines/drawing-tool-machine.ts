import type { Point } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { assign, fromCallback } from "xstate";
import { createToolMachine } from "./tool-machine-factory";
import type { PointerToolEvent, ToolContext } from "./types";

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
	drawingMode: "freehand" | "straight" | "smooth";
}

// === Drawing Tool Events ===
export type DrawingToolEvent =
	| PointerToolEvent
	| { type: "SET_COLOR"; color: string }
	| { type: "SET_WIDTH"; width: number }
	| { type: "SET_OPACITY"; opacity: number }
	| { type: "TOGGLE_MODE"; mode: "freehand" | "straight" | "smooth" }
	| { type: "PRESSURE_CHANGE"; pressure: number }
	| { type: "SMOOTH_TICK" }
	| { type: "CANCEL" }
	| { type: "ESCAPE" };

// === Helper Functions ===
function smoothPath(points: Point[], smoothingFactor: number = 0.5): Point[] {
	if (points.length < 3) return points;

	const firstPoint = points[0];
	const lastPoint = points[points.length - 1];
	if (!firstPoint || !lastPoint) return points;

	const smoothed: Point[] = [firstPoint];

	for (let i = 1; i < points.length - 1; i++) {
		const prev = points[i - 1];
		const curr = points[i];
		const next = points[i + 1];

		if (!prev || !curr || !next) continue;

		smoothed.push({
			x: curr.x * (1 - smoothingFactor) + (prev.x + next.x) * smoothingFactor * 0.5,
			y: curr.y * (1 - smoothingFactor) + (prev.y + next.y) * smoothingFactor * 0.5,
		});
	}

	smoothed.push(lastPoint);
	return smoothed;
}

function simplifyPath(points: Point[], tolerance: number = 1): Point[] {
	// Douglas-Peucker algorithm for path simplification
	if (points.length < 3) return points;

	// Find the point with the maximum distance
	let maxDist = 0;
	let maxIndex = 0;

	const first = points[0];
	const last = points[points.length - 1];
	if (!first || !last) return points;

	for (let i = 1; i < points.length - 1; i++) {
		const point = points[i];
		if (!point) continue;
		const dist = pointToLineDistance(point, first, last);
		if (dist > maxDist) {
			maxDist = dist;
			maxIndex = i;
		}
	}

	// If max distance is greater than tolerance, recursively simplify
	if (maxDist > tolerance) {
		const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
		const right = simplifyPath(points.slice(maxIndex), tolerance);

		return [...left.slice(0, -1), ...right];
	}

	return [first, last];
}

function pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
	const A = point.x - lineStart.x;
	const B = point.y - lineStart.y;
	const C = lineEnd.x - lineStart.x;
	const D = lineEnd.y - lineStart.y;

	const dot = A * C + B * D;
	const lenSq = C * C + D * D;
	let param = -1;

	if (lenSq !== 0) {
		param = dot / lenSq;
	}

	let xx: number, yy: number;

	if (param < 0) {
		xx = lineStart.x;
		yy = lineStart.y;
	} else if (param > 1) {
		xx = lineEnd.x;
		yy = lineEnd.y;
	} else {
		xx = lineStart.x + param * C;
		yy = lineStart.y + param * D;
	}

	const dx = point.x - xx;
	const dy = point.y - yy;

	return Math.sqrt(dx * dx + dy * dy);
}

// === Drawing Tool State Machine ===
export const drawingToolMachine = createToolMachine<DrawingToolContext>({
	id: "drawingTool",

	context: {
		cursor: "crosshair",
		selectedIds: new Set(),
		hoveredId: null,
		currentStroke: [],
		strokeStyle: {
			color: "#000000",
			width: 2,
			opacity: 1,
		},
		isDrawing: false,
		pressure: 1,
		drawingMode: "freehand",
	},

	states: {
		idle: {
			entry: ["resetStroke", "setCrosshairCursor"],

			on: {
				POINTER_DOWN: {
					target: "drawing",
					actions: "startStroke",
				},

				// Style changes
				SET_COLOR: {
					actions: "setColor",
				},
				SET_WIDTH: {
					actions: "setWidth",
				},
				SET_OPACITY: {
					actions: "setOpacity",
				},
				TOGGLE_MODE: {
					actions: "toggleDrawingMode",
				},
			},
		},

		drawing: {
			entry: assign({ isDrawing: true }),
			exit: assign({ isDrawing: false }),

			// Nested states for different drawing modes
			initial: "detectMode",

			states: {
				detectMode: {
					always: [
						{ target: "smooth", cond: "isSmoothMode" },
						{ target: "straight", cond: "isStraightMode" },
						{ target: "freehand" },
					],
				},

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
							actions: "performSmoothing",
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

				ESCAPE: {
					target: "idle",
					actions: "cancelStroke",
				},

				CANCEL: {
					target: "idle",
					actions: "cancelStroke",
				},
			},
		},
	},

	actions: {
		// Cursor management
		setCrosshairCursor: assign({
			cursor: "crosshair",
		}),

		// Stroke management
		resetStroke: assign({
			currentStroke: [],
		}),

		startStroke: assign((_context, event: PointerToolEvent) => ({
			currentStroke: [event.point],
			cursor: "crosshair",
		})),

		addPoint: assign((context: any, event: PointerToolEvent) => ({
			currentStroke: [...context.currentStroke, event.point],
		})),

		addSmoothPoint: assign((context: any, event: PointerToolEvent) => {
			const newStroke = [...context.currentStroke, event.point];
			// Apply smoothing only to the last few points for performance
			if (newStroke.length > 5) {
				const lastPoints = newStroke.slice(-5);
				const smoothedLast = smoothPath(lastPoints, 0.3);
				return {
					currentStroke: [...newStroke.slice(0, -5), ...smoothedLast],
				};
			}
			return { currentStroke: newStroke };
		}),

		performSmoothing: assign((context: any) => {
			if (context.currentStroke.length > 2) {
				return {
					currentStroke: smoothPath(context.currentStroke, 0.5),
				};
			}
			return {};
		}),

		updateStraightLine: assign((context: any, event: PointerToolEvent) => {
			if (context.currentStroke.length === 0) return {};

			// Keep only first and current point for straight line
			const firstPoint = context.currentStroke[0];
			if (!firstPoint) return {};
			return {
				currentStroke: [firstPoint, event.point],
			};
		}),

		finalizeStroke: ({ context }: any) => {
			if (context.currentStroke.length > 1) {
				// Simplify the path before saving
				const simplified =
					context.drawingMode === "freehand"
						? simplifyPath(context.currentStroke, 1.5)
						: context.currentStroke;

				// Create a path shape as FreedrawShape
				const shape: any = {
					id: `shape-${Date.now()}`,
					type: "freedraw",
					x: 0,
					y: 0,
					rotation: 0,
					opacity: context.strokeStyle.opacity,
					strokeColor: context.strokeStyle.color,
					fillColor: "transparent",
					strokeWidth: context.strokeStyle.width,
					points: simplified,
				};

				whiteboardStore.getState().addShape(shape);
			}
		},

		cancelStroke: assign({
			currentStroke: [],
		}),

		// Style actions
		setColor: assign((context: any, event: { type: "SET_COLOR"; color: string }) => ({
			strokeStyle: {
				...context.strokeStyle,
				color: event.color,
			},
		})),

		setWidth: assign((context: any, event: { type: "SET_WIDTH"; width: number }) => ({
			strokeStyle: {
				...context.strokeStyle,
				width: event.width,
			},
		})),

		setOpacity: assign((context: any, event: { type: "SET_OPACITY"; opacity: number }) => ({
			strokeStyle: {
				...context.strokeStyle,
				opacity: event.opacity,
			},
		})),

		updatePressure: assign((_, event: { type: "PRESSURE_CHANGE"; pressure: number }) => ({
			pressure: event.pressure,
		})),

		toggleDrawingMode: assign(
			(_context, event: { type: "TOGGLE_MODE"; mode: "freehand" | "straight" | "smooth" }) => ({
				drawingMode: event.mode,
			}),
		),
	},

	guards: {
		isSmoothMode: ({ context }: any) => context.drawingMode === "smooth",
		isStraightMode: ({ context }: any) => context.drawingMode === "straight",
	},

	services: {
		smoothingService: fromCallback(({ sendBack }) => {
			const interval = setInterval(() => {
				sendBack({ type: "SMOOTH_TICK" });
			}, 16); // 60fps

			return () => clearInterval(interval);
		}),
	},
});

// === Rectangle Tool State Machine ===
export const rectangleToolMachine = createToolMachine<DrawingToolContext>({
	id: "rectangleTool",

	context: {
		cursor: "crosshair",
		selectedIds: new Set(),
		hoveredId: null,
		currentStroke: [],
		strokeStyle: {
			color: "#000000",
			width: 2,
			opacity: 1,
		},
		isDrawing: false,
		pressure: 1,
		drawingMode: "freehand",
	},

	states: {
		idle: {
			entry: "setCrosshairCursor",

			on: {
				POINTER_DOWN: {
					target: "drawing",
					actions: "startRectangle",
				},
			},
		},

		drawing: {
			on: {
				POINTER_MOVE: {
					actions: "updateRectangle",
				},
				POINTER_UP: {
					target: "idle",
					actions: "finalizeRectangle",
				},
				ESCAPE: {
					target: "idle",
					actions: "cancelRectangle",
				},
			},
		},
	},

	actions: {
		setCrosshairCursor: assign({
			cursor: "crosshair",
		}),

		startRectangle: assign((_, event: PointerToolEvent) => ({
			currentStroke: [event.point],
		})),

		updateRectangle: assign((context: any, event: PointerToolEvent) => {
			if (context.currentStroke.length === 0) return {};
			const firstPoint = context.currentStroke[0];
			if (!firstPoint) return {};
			return {
				currentStroke: [firstPoint, event.point],
			};
		}),

		finalizeRectangle: ({ context }: any) => {
			if (context.currentStroke.length === 2) {
				const [start, end] = context.currentStroke;
				const x = Math.min(start.x, end.x);
				const y = Math.min(start.y, end.y);
				const width = Math.abs(end.x - start.x);
				const height = Math.abs(end.y - start.y);

				if (width > 0 && height > 0) {
					const shape: any = {
						id: `shape-${Date.now()}`,
						type: "rectangle",
						x,
						y,
						width,
						height,
						rotation: 0,
						opacity: context.strokeStyle.opacity,
						strokeColor: context.strokeStyle.color,
						fillColor: "transparent",
						strokeWidth: context.strokeStyle.width,
					};

					whiteboardStore.getState().addShape(shape);
				}
			}
		},

		cancelRectangle: assign({
			currentStroke: [],
		}),
	},
});
