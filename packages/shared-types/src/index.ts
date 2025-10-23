// Export all types
export * from "./background";
export * from "./defaults/shape-styles";
export * from "./effects";
export * from "./layer";
export * from "./relationship";
export * from "./styles";

import type { LayerMetadata } from "./layer";
import type { ShadowProperties } from "./styles";

// Common geometry types
export interface Point {
	x: number;
	y: number;
}

export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

// Base shape interface
export interface BaseShape {
	id: string;
	type: "rectangle" | "ellipse" | "line" | "text" | "freedraw" | "group";
	x: number; // World coordinates
	y: number; // World coordinates
	rotation: number; // Radians
	opacity: number;
	strokeColor: string;
	fillColor: string;
	strokeWidth: number;
	shadow?: ShadowProperties; // Optional shadow settings
	layer?: LayerMetadata; // Layer information (optional for backward compatibility)
}

// Rectangle shape
export interface RectangleShape extends BaseShape {
	type: "rectangle";
	width: number;
	height: number;
}

// Ellipse shape
export interface EllipseShape extends BaseShape {
	type: "ellipse";
	width: number;
	height: number;
}

// Line shape
export interface LineShape extends BaseShape {
	type: "line";
	x2: number;
	y2: number;
}

// Text shape
export interface TextShape extends BaseShape {
	type: "text";
	text: string;
	fontSize: number;
	fontFamily: string;
}

// Freedraw shape
export interface FreedrawShape extends BaseShape {
	type: "freedraw";
	width: number;
	height: number;
	points: Array<{ x: number; y: number }>; // Points are relative to (x, y)
	path?: string; // SVG path data
}

// Group shape (composite pattern)
export interface GroupShape extends BaseShape {
	type: "group";
	width: number; // Bounding box width
	height: number; // Bounding box height
	name: string; // Group name
	childIds: string[]; // IDs of shapes in this group
	collapsed: boolean; // UI state for layer panel
}

// Union type for all shapes
export type Shape =
	| RectangleShape
	| EllipseShape
	| LineShape
	| TextShape
	| FreedrawShape
	| GroupShape;

// Camera/Viewport state
export interface Camera {
	x: number;
	y: number;
	zoom: number;
}

// Pointer coordinate types with both screen and world coordinates
export interface PointerCoordinates {
	screen: Point; // Screen coordinates (relative to viewport)
	world: Point; // World coordinates (accounting for camera transform)
}

// Whiteboard state
export interface WhiteboardState {
	shapes: Record<string, Shape>;
	selectedShapeIds: Set<string>;
	camera: Camera;
	currentTool: string;
}

// Command Pattern types for Undo/Redo
export interface Command {
	id: string;
	timestamp: number;
	description: string;
	execute(context: CommandContext): void;
	undo(context: CommandContext): void;
	redo?(context: CommandContext): void;
	canMerge?(other: Command): boolean;
	merge?(other: Command): Command;
}

export interface CommandContext {
	getState: () => WhiteboardState;
	setState: (updater: (state: WhiteboardState) => void) => void;
}

export interface HistoryState {
	canUndo: boolean;
	canRedo: boolean;
	undoStack: ReadonlyArray<Command>;
	redoStack: ReadonlyArray<Command>;
}

// Background options
export interface BackgroundOptions {
	renderer?: string;
	color?: string;
	config?: any;
}

// Command Pattern types for Undo/Redo
export interface CommandContext {
	getState: () => WhiteboardState;
	setState: (updater: (state: WhiteboardState) => void) => void;
}

export interface Command {
	id: string;
	timestamp: number;
	description: string;
	execute(context: CommandContext): void;
	undo(context: CommandContext): void;
	redo?(context: CommandContext): void;
	canMerge?(other: Command): boolean;
	merge?(other: Command): Command;
}

export interface HistoryState {
	canUndo: boolean;
	canRedo: boolean;
	commandCount: number;
	currentIndex: number;
}
