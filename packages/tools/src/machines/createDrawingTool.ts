import type { FreedrawShape } from "@usketch/shared-types";
import { assign, setup } from "xstate";
import type { Point, ToolContext } from "../types";

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
	previewShape: FreedrawShape | null;
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
	| { type: "ESCAPE" };

// === Drawing Tool Factory ===
export function createDrawingTool() {
	return setup({
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
				if (event.type !== "POINTER_MOVE" || !context.isDrawing) return {};

				// Only add point if it's different from the last one
				const lastPoint = context.currentStroke[context.currentStroke.length - 1];
				if (lastPoint && lastPoint.x === event.point.x && lastPoint.y === event.point.y) {
					return {};
				}

				const newStroke = [...context.currentStroke, event.point];

				// Calculate bounding box for preview
				const minX = Math.min(...newStroke.map((p) => p.x));
				const minY = Math.min(...newStroke.map((p) => p.y));
				const maxX = Math.max(...newStroke.map((p) => p.x));
				const maxY = Math.max(...newStroke.map((p) => p.y));

				// Add padding for stroke width to prevent clipping
				const padding = Math.ceil(context.strokeStyle.width / 2);

				// Create preview shape with proper bounding box
				const previewShape: FreedrawShape = {
					id: "preview-draw",
					type: "freedraw",
					x: minX - padding,
					y: minY - padding,
					width: Math.max(1, maxX - minX + padding * 2),
					height: Math.max(1, maxY - minY + padding * 2),
					rotation: 0,
					opacity: context.strokeStyle.opacity * 0.5, // Make preview semi-transparent
					strokeColor: context.strokeStyle.color,
					fillColor: "transparent",
					strokeWidth: context.strokeStyle.width,
					points: newStroke, // Keep absolute world coordinates
				};

				return {
					currentStroke: newStroke,
					previewShape,
				};
			}),

			finishStroke: ({ context }) => {
				if (!context.currentStroke || context.currentStroke.length < 2) {
					return;
				}

				// Calculate bounding box for proper positioning
				const minX = Math.min(...context.currentStroke.map((p) => p.x));
				const minY = Math.min(...context.currentStroke.map((p) => p.y));
				const maxX = Math.max(...context.currentStroke.map((p) => p.x));
				const maxY = Math.max(...context.currentStroke.map((p) => p.y));

				// Add padding for stroke width to prevent clipping
				const padding = Math.ceil(context.strokeStyle.width / 2);

				// Create the final shape with absolute points
				// Store the bounding box position in x, y for transform
				const shape: FreedrawShape = {
					id: `draw-${Date.now()}`,
					type: "freedraw",
					x: minX - padding,
					y: minY - padding,
					width: maxX - minX + padding * 2 || 1, // Ensure minimum width
					height: maxY - minY + padding * 2 || 1, // Ensure minimum height
					rotation: 0,
					opacity: context.strokeStyle.opacity,
					strokeColor: context.strokeStyle.color,
					fillColor: "transparent",
					strokeWidth: context.strokeStyle.width,
					points: context.currentStroke, // Keep absolute world coordinates
				};

				// Debug: Log the created shape
				console.log("Created freedraw shape:", {
					id: shape.id,
					x: shape.x,
					y: shape.y,
					width: shape.width,
					height: shape.height,
					pointsCount: shape.points.length,
					firstPoint: shape.points[0],
					lastPoint: shape.points[shape.points.length - 1],
				});

				// The adapter will handle adding to store
				if (typeof window !== "undefined") {
					window.__lastCreatedShape = shape;
				} else if (typeof global !== "undefined") {
					global.__lastCreatedShape = shape;
				}
			},

			resetStroke: assign({
				currentStroke: [],
				isDrawing: false,
				cursor: "crosshair",
				previewShape: null,
			}),

			cancelStroke: assign({
				currentStroke: [],
				isDrawing: false,
				cursor: "crosshair",
				previewShape: null,
			}),

			updateStrokeColor: assign(({ context, event }) => {
				if (event.type !== "SET_COLOR") return {};
				return {
					strokeStyle: {
						...context.strokeStyle,
						color: event.color,
					},
				};
			}),

			updateStrokeWidth: assign(({ context, event }) => {
				if (event.type !== "SET_WIDTH") return {};
				return {
					strokeStyle: {
						...context.strokeStyle,
						width: event.width,
					},
				};
			}),

			updateStrokeOpacity: assign(({ context, event }) => {
				if (event.type !== "SET_OPACITY") return {};
				return {
					strokeStyle: {
						...context.strokeStyle,
						opacity: event.opacity,
					},
				};
			}),
		},
	}).createMachine({
		id: "drawingTool",
		initial: "idle",
		context: {
			cursor: "crosshair",
			currentStroke: [],
			strokeStyle: {
				color: "#000000",
				width: 2,
				opacity: 1,
			},
			isDrawing: false,
			pressure: 1,
			selectedIds: new Set(),
			hoveredId: null,
			previewShape: null,
		},
		states: {
			idle: {
				on: {
					POINTER_DOWN: {
						target: "drawing",
						actions: "startStroke",
					},
					SET_COLOR: {
						actions: "updateStrokeColor",
					},
					SET_WIDTH: {
						actions: "updateStrokeWidth",
					},
					SET_OPACITY: {
						actions: "updateStrokeOpacity",
					},
				},
			},
			drawing: {
				on: {
					POINTER_MOVE: {
						actions: "addPoint",
					},
					POINTER_UP: {
						target: "idle",
						actions: ["finishStroke", "resetStroke"],
					},
					ESCAPE: {
						target: "idle",
						actions: "cancelStroke",
					},
				},
			},
		},
	});
}
