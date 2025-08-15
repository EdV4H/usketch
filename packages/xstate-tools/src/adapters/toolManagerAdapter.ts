import type { Point, Shape } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import { createActor } from "xstate";
import { createRectangleTool } from "../machines/rectangleTool";
import { createSelectTool } from "../machines/selectTool";
import { createToolManager } from "../machines/toolManager";

// Adapter class that provides the same interface as the legacy ToolManager
export class XStateToolManager {
	private toolManagerActor: any;
	private currentToolId = "select";

	constructor() {
		// Create tool machines
		const selectTool = createSelectTool();
		const rectangleTool = createRectangleTool();

		// Create and start the tool manager
		const toolManagerMachine = createToolManager({
			select: selectTool,
			rectangle: rectangleTool,
		});

		this.toolManagerActor = createActor(toolManagerMachine);
		this.toolManagerActor.start();

		// Subscribe to tool changes
		this.toolManagerActor.subscribe((state: any) => {
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
			rectangle: "rectangle", // Rectangle has its own tool now
		};
		return mapping[toolId] || toolId;
	}

	getActiveTool(): string {
		return this.currentToolId;
	}

	// Event delegation methods
	handlePointerDown(event: PointerEvent, worldPos: Point): void {
		// Get the target element
		const target = event.target as HTMLElement;
		const isShape = target?.dataset?.shape === "true";
		const shapeId = target?.dataset?.shapeId;

		// If select tool and clicking on a shape, handle selection
		if (this.currentToolId === "select" && isShape && shapeId) {
			const store = whiteboardStore.getState();
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
		}

		this.toolManagerActor.send({
			type: "POINTER_DOWN",
			position: worldPos,
			event: {
				clientX: event.clientX,
				clientY: event.clientY,
				button: event.button,
				shiftKey: event.shiftKey,
				ctrlKey: event.ctrlKey,
				metaKey: event.metaKey,
				altKey: event.altKey,
				target: isShape ? { id: shapeId, element: target } : null,
			},
		});
	}

	handlePointerMove(event: PointerEvent, worldPos: Point): void {
		this.toolManagerActor.send({
			type: "POINTER_MOVE",
			position: worldPos,
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

		// Check if rectangle tool created a shape
		if (this.currentToolId === "rectangle") {
			const shape = (globalThis as any).__lastCreatedShape;
			if (shape) {
				whiteboardStore.getState().addShape(shape);
				delete (globalThis as any).__lastCreatedShape;
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
