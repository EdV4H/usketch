import type { ToolBehaviors, ToolConfig } from "../schemas";
import { createPanTool } from "../tools/pan-tool";
import { createSelectTool } from "../tools/select-tool";
import {
	ellipseToolMachine,
	freedrawToolMachine,
	rectangleToolMachine,
} from "../tools/shape-drawing-tool";
import { getShapeAtPoint } from "../utils/geometry";

/**
 * Select tool behaviors - handle selection logic
 */
const selectToolBehaviors: ToolBehaviors = {
	onDeactivate: ({ store }) => {
		// Clear selection when switching away from select tool
		store.clearSelection();
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
 * Shape tool behaviors - handle shape creation (rectangle, ellipse, freedraw)
 */
const shapeToolBehaviors: ToolBehaviors = {
	onShapeCreated: ({ shape, store }) => {
		// Add the created shape to the store
		store.addShape(shape);
	},
};

/**
 * Pan tool behaviors - handle canvas panning
 */
const panToolBehaviors: ToolBehaviors = {
	// Pan tool doesn't need special behaviors
	// All logic is handled in the state machine
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
			machine: rectangleToolMachine,
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
			behaviors: shapeToolBehaviors,
		},
		{
			id: "ellipse",
			machine: ellipseToolMachine,
			displayName: "Ellipse",
			icon: "circle",
			shortcut: "o",
			enabled: true,
			metadata: {
				author: "uSketch Team",
				version: "1.0.0",
				description: "Draw ellipses",
				category: "drawing",
			},
			behaviors: shapeToolBehaviors,
		},
		{
			id: "draw",
			machine: freedrawToolMachine,
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
			behaviors: shapeToolBehaviors,
		},
		{
			id: "pan",
			machine: createPanTool(),
			displayName: "Hand",
			icon: "hand",
			shortcut: "h",
			enabled: true,
			metadata: {
				author: "uSketch Team",
				version: "1.0.0",
				description: "Pan the canvas by dragging",
				category: "navigation",
			},
			behaviors: panToolBehaviors,
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
