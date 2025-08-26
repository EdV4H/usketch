import type { Point, Shape } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import type { Actor, AnyStateMachine } from "xstate";
import { createActor } from "xstate";
import { createDrawingTool } from "../machines/drawingTool";
import { createRectangleTool } from "../machines/rectangleTool";
import { createSelectTool } from "../machines/selectTool";
import { createToolManager } from "../machines/toolManager";
import { getShapeAtPoint } from "../utils/geometry";

// ToolManager implementation using XState v5
export class ToolManager {
	private toolManagerActor: Actor<AnyStateMachine>;
	private currentToolId = "select";

	constructor() {
		// Create tool machines
		const selectTool = createSelectTool();
		const rectangleTool = createRectangleTool();
		const drawingTool = createDrawingTool();

		// Create and start the tool manager
		const toolManagerMachine = createToolManager({
			select: selectTool,
			rectangle: rectangleTool,
			draw: drawingTool,
		});

		this.toolManagerActor = createActor(toolManagerMachine);
		this.toolManagerActor.start();

		// Subscribe to tool changes
		this.toolManagerActor.subscribe((state) => {
			const activeToolId = state.context.activeTool;
			if (activeToolId !== this.currentToolId) {
				this.currentToolId = activeToolId;
			}
		});

		// Set initial tool
		this.setActiveTool("select");
	}

	// Match the legacy ToolManager interface
	setActiveTool(toolId: string, updateStore = true): void {
		// Map legacy tool IDs to XState tool IDs
		const xstateToolId = this.mapLegacyToolId(toolId);

		// Clear selection when switching away from select tool
		if (this.currentToolId === "select" && toolId !== "select") {
			whiteboardStore.getState().clearSelection();

			// Also clear any selection box overlay
			const selectionBoxElement = document.getElementById("selection-box-overlay");
			if (selectionBoxElement) {
				selectionBoxElement.style.display = "none";
				selectionBoxElement.style.width = "0px";
				selectionBoxElement.style.height = "0px";
			}
		}

		// Send switch event to the state machine
		this.toolManagerActor.send({
			type: "SWITCH_TOOL",
			tool: xstateToolId,
		});

		// Update store if requested
		if (updateStore) {
			whiteboardStore.setState({ currentTool: toolId });
		}

		this.currentToolId = toolId;
	}

	private mapLegacyToolId(toolId: string): string {
		// Map legacy tool IDs to XState tool IDs
		const mapping: Record<string, string> = {
			select: "select",
			rectangle: "rectangle",
			draw: "draw",
		};
		return mapping[toolId] || toolId;
	}

	getActiveTool(): string {
		return this.currentToolId;
	}

	// Get preview shape from the current tool
	getPreviewShape(): Shape | null {
		if (this.currentToolId === "rectangle" || this.currentToolId === "draw") {
			const snapshot = this.toolManagerActor.getSnapshot();
			const toolActor = snapshot.context.currentToolActor;
			if (toolActor) {
				const toolSnapshot = toolActor.getSnapshot();
				return toolSnapshot.context.previewShape;
			}
		}
		return null;
	}

	// Event delegation methods
	handlePointerDown(event: PointerEvent, worldPos: Point): void {
		// Get shape at the clicked position using world coordinates
		const shape = getShapeAtPoint(worldPos);
		const isShape = !!shape;
		const shapeId = shape?.id;

		// If select tool, handle selection logic
		if (this.currentToolId === "select") {
			const store = whiteboardStore.getState();
			if (isShape && shapeId) {
				// Clicking on a shape
				if (event.shiftKey || event.ctrlKey || event.metaKey) {
					// Toggle selection with modifier keys
					if (store.selectedShapeIds.has(shapeId)) {
						store.deselectShape(shapeId);
					} else {
						store.selectShape(shapeId);
					}
				} else {
					// If clicking on already selected shape, don't change selection
					// This allows dragging multiple selected shapes
					if (!store.selectedShapeIds.has(shapeId)) {
						// Clear selection and select only this shape
						store.clearSelection();
						store.selectShape(shapeId);
					}
					// If shape is already selected, keep the current selection
				}
			} else {
				// Clicking on empty space - clear selection
				// Only clear if there are selected shapes
				if (store.selectedShapeIds.size > 0) {
					store.clearSelection();
				}
			}
		}

		// Send the event in the format each tool expects
		// SelectTool expects "point", Rectangle/Drawing tools expect "position"
		const eventToSend: any = {
			type: "POINTER_DOWN" as const,
			point: worldPos,
			position: worldPos, // Add position for drawing tools
			target: shapeId,
			event: event, // Pass original event for drawing tools
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
		};
		this.toolManagerActor.send(eventToSend);
	}

	handlePointerMove(event: PointerEvent, worldPos: Point): void {
		this.toolManagerActor.send({
			type: "POINTER_MOVE" as const,
			point: worldPos,
			position: worldPos, // Add position for drawing tools
			event: event, // Pass original event for drawing tools
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
		});
	}

	handlePointerUp(event: PointerEvent, worldPos: Point): void {
		this.toolManagerActor.send({
			type: "POINTER_UP" as const,
			point: worldPos,
			position: worldPos, // Add position for drawing tools
			event: event, // Pass original event for drawing tools
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
		});

		// Check if rectangle or draw tool created a shape
		if (this.currentToolId === "rectangle" || this.currentToolId === "draw") {
			if (typeof window !== "undefined" && window.__lastCreatedShape) {
				whiteboardStore.getState().addShape(window.__lastCreatedShape);
				delete window.__lastCreatedShape;
			} else if (typeof global !== "undefined" && global.__lastCreatedShape) {
				whiteboardStore.getState().addShape(global.__lastCreatedShape);
				delete global.__lastCreatedShape;
			}
		}
	}

	handleKeyDown(event: KeyboardEvent): void {
		this.toolManagerActor.send({
			type: "KEY_DOWN",
			key: event.key,
			code: event.code,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
		});
	}

	handleKeyUp(event: KeyboardEvent): void {
		this.toolManagerActor.send({
			type: "KEY_UP",
			key: event.key,
			code: event.code,
			shiftKey: event.shiftKey,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
		});
	}

	// Clean up method
	destroy(): void {
		this.toolManagerActor.stop();
	}
}
