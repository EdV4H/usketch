import { assign, setup } from "xstate";
import type { Point, Shape, ToolContext } from "../types";

// === Rectangle Tool Context ===
export interface RectangleToolContext extends ToolContext {
	startPoint: Point | null;
	currentPoint: Point | null;
	isDrawing: boolean;
	strokeStyle: {
		strokeColor: string;
		fillColor: string;
		strokeWidth: number;
		opacity: number;
	};
	previewShape: Shape | null;
}

// === Rectangle Tool Events ===
export type RectangleToolEvent =
	| { type: "POINTER_DOWN"; position: Point; event: any }
	| { type: "POINTER_MOVE"; position: Point; event: any }
	| { type: "POINTER_UP"; position: Point; event: any }
	| { type: "SET_STROKE_COLOR"; color: string }
	| { type: "SET_FILL_COLOR"; color: string }
	| { type: "SET_STROKE_WIDTH"; width: number }
	| { type: "SET_OPACITY"; opacity: number }
	| { type: "ESCAPE" }
	| { type: "KEY_DOWN"; key: string; shiftKey: boolean };

// === Rectangle Tool Machine (XState v5) ===
export const rectangleToolMachine = setup({
	types: {
		context: {} as RectangleToolContext,
		events: {} as RectangleToolEvent,
	},
	actions: {
		startDrawing: assign(({ event }) => {
			if (event.type !== "POINTER_DOWN") return {};
			return {
				startPoint: event.position,
				currentPoint: event.position,
				isDrawing: true,
				cursor: "crosshair",
			};
		}),

		updateRectangle: assign(({ context, event }) => {
			if (event.type !== "POINTER_MOVE" || !context.startPoint) return {};

			const startX = Math.min(context.startPoint.x, event.position.x);
			const startY = Math.min(context.startPoint.y, event.position.y);
			const width = Math.abs(event.position.x - context.startPoint.x);
			const height = Math.abs(event.position.y - context.startPoint.y);

			// Create square if shift is held
			let finalWidth = width;
			let finalHeight = height;
			if (event.event?.shiftKey) {
				const size = Math.max(width, height);
				finalWidth = size;
				finalHeight = size;
			}

			const previewShape: Shape = {
				id: "preview-rect",
				type: "rectangle",
				x: startX,
				y: startY,
				width: finalWidth,
				height: finalHeight,
				rotation: 0,
				opacity: context.strokeStyle.opacity,
				strokeColor: context.strokeStyle.strokeColor,
				fillColor: context.strokeStyle.fillColor,
				strokeWidth: context.strokeStyle.strokeWidth,
			};

			return {
				currentPoint: event.position,
				previewShape,
			};
		}),

		createRectangle: ({ context }) => {
			if (!context.startPoint || !context.currentPoint) return;

			const startX = Math.min(context.startPoint.x, context.currentPoint.x);
			const startY = Math.min(context.startPoint.y, context.currentPoint.y);
			const width = Math.abs(context.currentPoint.x - context.startPoint.x);
			const height = Math.abs(context.currentPoint.y - context.startPoint.y);

			// Don't create tiny rectangles
			if (width < 5 || height < 5) return;

			// Access the store directly to add the shape
			// This will be handled by the adapter
			const shape: Shape = {
				id: `rect-${Date.now()}`,
				type: "rectangle",
				x: startX,
				y: startY,
				width,
				height,
				rotation: 0,
				opacity: context.strokeStyle.opacity,
				strokeColor: context.strokeStyle.strokeColor,
				fillColor: context.strokeStyle.fillColor,
				strokeWidth: context.strokeStyle.strokeWidth,
			};

			// The adapter will handle adding to store
			(globalThis as any).__lastCreatedShape = shape;
		},

		resetDrawing: assign({
			startPoint: null,
			currentPoint: null,
			isDrawing: false,
			previewShape: null,
			cursor: "crosshair",
		}),

		cancelDrawing: assign({
			startPoint: null,
			currentPoint: null,
			isDrawing: false,
			previewShape: null,
		}),

		updateStrokeColor: assign(({ context, event }) => {
			if (event.type !== "SET_STROKE_COLOR") return {};
			return {
				strokeStyle: {
					...context.strokeStyle,
					strokeColor: event.color,
				},
			};
		}),

		updateFillColor: assign(({ context, event }) => {
			if (event.type !== "SET_FILL_COLOR") return {};
			return {
				strokeStyle: {
					...context.strokeStyle,
					fillColor: event.color,
				},
			};
		}),

		updateStrokeWidth: assign(({ context, event }) => {
			if (event.type !== "SET_STROKE_WIDTH") return {};
			return {
				strokeStyle: {
					...context.strokeStyle,
					strokeWidth: event.width,
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
}).createMachine({
	id: "rectangleTool",
	initial: "idle",

	context: {
		startPoint: null,
		currentPoint: null,
		isDrawing: false,
		strokeStyle: {
			strokeColor: "#333333",
			fillColor: "#e0e0ff",
			strokeWidth: 2,
			opacity: 1,
		},
		previewShape: null,
		cursor: "crosshair",
		selectedIds: new Set(),
		hoveredId: null,
	},

	states: {
		idle: {
			entry: "resetDrawing",
			on: {
				POINTER_DOWN: {
					target: "drawing",
					actions: "startDrawing",
				},

				// Style changes
				SET_STROKE_COLOR: {
					actions: "updateStrokeColor",
				},
				SET_FILL_COLOR: {
					actions: "updateFillColor",
				},
				SET_STROKE_WIDTH: {
					actions: "updateStrokeWidth",
				},
				SET_OPACITY: {
					actions: "updateOpacity",
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
					actions: ["createRectangle", "resetDrawing"],
				},

				ESCAPE: {
					target: "idle",
					actions: "cancelDrawing",
				},

				KEY_DOWN: [
					{
						target: "idle",
						actions: "cancelDrawing",
						guard: ({ event }) => event.type === "KEY_DOWN" && event.key === "Escape",
					},
				],
			},
		},
	},
});

export function createRectangleTool() {
	return rectangleToolMachine;
}
