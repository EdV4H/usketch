import type { PointerCoordinates } from "@usketch/shared-types";
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
	| { type: "POINTER_DOWN"; point: Point | PointerCoordinates }
	| { type: "POINTER_MOVE"; point: Point | PointerCoordinates }
	| { type: "POINTER_UP"; point: Point | PointerCoordinates }
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

			const state = whiteboardStore.getState();
			const camera = state.camera;

			// Use screen coordinates for panning
			const screenPoint = "screen" in event.point ? event.point.screen : event.point;

			return {
				...context,
				startPoint: screenPoint,
				initialViewport: { x: camera.x, y: camera.y },
				cursor: "grabbing" as const,
			};
		}),

		// Update viewport during drag
		updateViewport: (() => {
			let rafId: number | null = null;

			return ({ context, event }) => {
				if (event.type !== "POINTER_MOVE") return;
				if (!context.startPoint || !context.initialViewport) return;

				// Use screen coordinates for panning
				const screenPoint = "screen" in event.point ? event.point.screen : event.point;

				const dx = screenPoint.x - context.startPoint.x;
				const dy = screenPoint.y - context.startPoint.y;

				// Cancel previous frame request to avoid race conditions
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}

				// Use requestAnimationFrame to batch camera updates
				rafId = requestAnimationFrame(() => {
					// Camera moves in same direction as drag to create pan effect
					whiteboardStore.getState().setCamera({
						x: context.initialViewport.x + dx,
						y: context.initialViewport.y + dy,
					});
					rafId = null;
				});
			};
		})(),

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
