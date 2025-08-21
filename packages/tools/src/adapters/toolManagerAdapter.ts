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
					// Clear selection and select only this shape
					store.clearSelection();
					store.selectShape(shapeId);
				}
			} else {
				// Clicking on empty space - clear selection
				// Only clear if there are selected shapes
				if (store.selectedShapeIds.size > 0) {
					store.clearSelection();
				}
			}
		}

		this.toolManagerActor.send({
			type: "POINTER_DOWN",
			position: worldPos,
			point: worldPos, // Add point for select tool
			event: {
				clientX: event.clientX,
				clientY: event.clientY,
				button: event.button,
				shiftKey: event.shiftKey,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				altKey: event.altKey,
				target: isShape ? { id: shapeId, element: event.target as HTMLElement } : null,
			},
		});
	}

	handlePointerMove(event: PointerEvent, worldPos: Point): void {
		this.toolManagerActor.send({
			type: "POINTER_MOVE",
			position: worldPos,
			point: worldPos, // Add point for select tool
			event: {
				clientX: event.clientX,
				clientY: event.clientY,
				shiftKey: event.shiftKey,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				altKey: event.altKey,
			},
		});
	}

	handlePointerUp(event: PointerEvent, worldPos: Point): void {
		this.toolManagerActor.send({
			type: "POINTER_UP",
			position: worldPos,
			point: worldPos, // Add point for select tool
			event: {
				clientX: event.clientX,
				clientY: event.clientY,
				button: event.button,
				shiftKey: event.shiftKey,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				altKey: event.altKey,
			},
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
