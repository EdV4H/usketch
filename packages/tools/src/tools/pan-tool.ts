import { whiteboardStore } from "@usketch/store";
import { assign, setup } from "xstate";
import type { Point, ToolContext } from "../types/index";

// === Pan Tool Context ===
export interface PanToolContext extends ToolContext {
	// Pan start point (screen coordinates)
	startPoint: Point | null;
	// Initial viewport position when pan started
	initialViewport: { x: number; y: number } | null;
	// Cursor style
	cursor: "grab" | "grabbing";
}

// === Pan Tool Events ===
export type PanToolEvent =
	| { type: "POINTER_DOWN"; point: Point }
	| { type: "POINTER_MOVE"; point: Point }
	| { type: "POINTER_UP"; point: Point }
	| { type: "CANCEL" };

// === Pan Tool Machine (XState v5) ===
export const panToolMachine = setup({
	types: {
		context: {} as PanToolContext,
		events: {} as PanToolEvent,
	},
	actions: {
		// Initialize pan state when drag starts
		startPan: assign(({ context, event }) => {
			if (event.type !== "POINTER_DOWN") return context;

			const camera = whiteboardStore.getState().camera;

			return {
				...context,
				startPoint: event.point,
				initialViewport: { x: camera.x, y: camera.y },
				cursor: "grabbing" as const,
			};
		}),

		// Update viewport during drag
		updateViewport: ({ context, event }) => {
			if (event.type !== "POINTER_MOVE") return;
			if (!context.startPoint || !context.initialViewport) return;

			const dx = event.point.x - context.startPoint.x;
			const dy = event.point.y - context.startPoint.y;

			// Move viewport in opposite direction (canvas moves in drag direction)
			whiteboardStore.getState().setViewport({
				x: context.initialViewport.x - dx,
				y: context.initialViewport.y - dy,
			});
		},

		// Cleanup when pan ends
		endPan: assign(({ context }) => ({
			...context,
			startPoint: null,
			initialViewport: null,
			cursor: "grab" as const,
		})),
	},
}).createMachine({
	id: "panTool",

	initial: "idle",

	context: {
		startPoint: null,
		initialViewport: null,
		cursor: "grab",
		selectedIds: new Set(),
		hoveredId: null,
	},

	states: {
		idle: {
			on: {
				POINTER_DOWN: {
					target: "panning",
					actions: ["startPan"],
				},
			},
		},

		panning: {
			on: {
				POINTER_MOVE: {
					actions: ["updateViewport"],
				},
				POINTER_UP: {
					target: "idle",
					actions: ["endPan"],
				},
				CANCEL: {
					target: "idle",
					actions: ["endPan"],
				},
			},
		},
	},
});

// === Factory function for consistency with other tools ===
export function createPanTool() {
	return panToolMachine;
}
