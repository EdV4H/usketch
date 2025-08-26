import type { Point, Shape } from "@usketch/shared-types";

// Manual type definitions for tool behaviors since Zod function validation has limitations
export interface ToolBehaviors {
	// Tool lifecycle hooks
	onActivate?: (args: {
		store: any; // WhiteboardStore - avoiding circular dependency
		previousToolId?: string;
	}) => void;

	onDeactivate?: (args: {
		store: any; // WhiteboardStore
		nextToolId: string;
	}) => void;

	// Event pre-processing hooks (return true to prevent default handling)
	beforePointerDown?: (args: {
		event: PointerEvent;
		worldPos: Point;
		store: any; // WhiteboardStore
	}) => boolean;

	beforePointerMove?: (args: {
		event: PointerEvent;
		worldPos: Point;
		store: any; // WhiteboardStore
	}) => boolean;

	beforePointerUp?: (args: {
		event: PointerEvent;
		worldPos: Point;
		store: any; // WhiteboardStore
	}) => boolean;

	// Shape lifecycle hooks
	onShapeCreated?: (args: {
		shape: Shape;
		store: any; // WhiteboardStore
	}) => void;

	// Keyboard event hooks
	beforeKeyDown?: (args: {
		event: KeyboardEvent;
		store: any; // WhiteboardStore
	}) => boolean;
}
