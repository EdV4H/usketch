import { createDrawingTool } from "../machines/drawingTool";
import { createRectangleTool } from "../machines/rectangleTool";
import { createSelectTool } from "../machines/selectTool";
import type { ToolBehaviors, ToolConfig } from "../schemas";
import { getShapeAtPoint } from "../utils/geometry";

/**
 * Select tool behaviors - handle selection logic
 */
const selectToolBehaviors: ToolBehaviors = {
	onDeactivate: ({ store }) => {
		// Clear selection when switching away from select tool
		store.clearSelection();

		// Also clear any selection box overlay
		const selectionBoxElement = document.getElementById("selection-box-overlay");
		if (selectionBoxElement) {
			selectionBoxElement.style.display = "none";
			selectionBoxElement.style.width = "0px";
			selectionBoxElement.style.height = "0px";
		}
	},

	beforePointerDown: ({ event, worldPos, store }) => {
		// Get shape at the clicked position
		const shape = getShapeAtPoint(worldPos);
		const shapeId = shape?.id;

		if (shapeId) {
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

		// Continue with default processing
		return false;
	},
};

/**
 * Drawing tool behaviors - handle shape creation
 */
const drawingToolBehaviors: ToolBehaviors = {
	onShapeCreated: ({ shape, store }) => {
		// Add the created shape to the store
		store.addShape(shape);
	},
};

/**
 * Rectangle tool behaviors - handle shape creation
 */
const rectangleToolBehaviors: ToolBehaviors = {
	onShapeCreated: ({ shape, store }) => {
		// Add the created shape to the store
		store.addShape(shape);
	},
};

/**
 * Get default tool configurations
 */
export function getDefaultTools(): ToolConfig[] {
	return [
		{
			id: "select",
			machine: createSelectTool(),
			displayName: "Select",
			icon: "cursor",
			shortcut: "v",
			enabled: true,
			metadata: {
				author: "uSketch Team",
				version: "1.0.0",
				description: "Select and move shapes",
				category: "selection",
			},
			behaviors: selectToolBehaviors,
		},
		{
			id: "rectangle",
			machine: createRectangleTool(),
			displayName: "Rectangle",
			icon: "square",
			shortcut: "r",
			enabled: true,
			metadata: {
				author: "uSketch Team",
				version: "1.0.0",
				description: "Draw rectangles",
				category: "drawing",
			},
			behaviors: rectangleToolBehaviors,
		},
		{
			id: "draw",
			machine: createDrawingTool(),
			displayName: "Draw",
			icon: "pencil",
			shortcut: "d",
			enabled: true,
			metadata: {
				author: "uSketch Team",
				version: "1.0.0",
				description: "Free-hand drawing",
				category: "drawing",
			},
			behaviors: drawingToolBehaviors,
		},
	];
}

/**
 * Create a default tool manager with standard tools
 * (for backward compatibility)
 */
export function createDefaultToolManagerOptions() {
	return {
		tools: getDefaultTools(),
		defaultToolId: "select",
		validateOnAdd: true,
		allowDuplicates: false,
	};
}
