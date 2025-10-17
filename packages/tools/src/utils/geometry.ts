// === Geometry Utility Functions ===

import { globalShapeRegistry, type ShapeRegistry } from "@usketch/shape-registry";
import {
	DEFAULT_SHAPE_SIZE,
	DEFAULT_SHAPE_STYLES,
	type Shape as SharedShape,
} from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import type { Bounds, Point } from "../types/index";

// Resize handle types
export type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

// Use the Shape type from shared-types
type Shape = SharedShape;

// Get shape at a specific point
export function getShapeAtPoint(point: Point, registry?: ShapeRegistry): Shape | null {
	const state = whiteboardStore.getState();
	const shapes = Object.values(state.shapes);

	// Check shapes in reverse order (top to bottom)
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i];
		if (isPointInShape(point, shape, registry)) {
			return shape;
		}
	}
	return null;
}

// Type guard to check if shape has width and height
function hasWidthHeight(shape: Shape): shape is Shape & { width: number; height: number } {
	return "width" in shape && "height" in shape;
}

// Check if a point is inside a shape
function isPointInShape(point: Point, shape: Shape, registry?: ShapeRegistry): boolean {
	// First try to use shape-registry's hitTest for proper detection
	// Fall back to global registry if no registry provided (temporary for backward compatibility)
	const effectiveRegistry = registry || globalShapeRegistry;
	const plugin = effectiveRegistry.getPlugin(shape.type);
	if (plugin?.hitTest) {
		return plugin.hitTest(shape, point);
	}

	// Fallback to legacy detection for shapes without plugins
	// Handle different shape types
	if (shape.type === "freedraw") {
		// For freedraw shapes, always use points array if available
		// Points are in absolute world coordinates
		if (shape.points && shape.points.length > 0) {
			const minX = Math.min(...shape.points.map((p: Point) => p.x));
			const minY = Math.min(...shape.points.map((p: Point) => p.y));
			const maxX = Math.max(...shape.points.map((p: Point) => p.x));
			const maxY = Math.max(...shape.points.map((p: Point) => p.y));

			// Add some padding for easier selection
			const padding = 10;
			const isInside =
				point.x >= minX - padding &&
				point.x <= maxX + padding &&
				point.y >= minY - padding &&
				point.y <= maxY + padding;

			return isInside;
		}
	}

	// For shapes with width and height (rectangle, ellipse)
	if (hasWidthHeight(shape)) {
		const { x, y, width, height } = shape;
		return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
	}

	// Default case - use x, y if available
	return false;
}

// Get shapes within bounds
export function getShapesInBounds(bounds: Bounds): Shape[] {
	const state = whiteboardStore.getState();
	const shapes = Object.values(state.shapes);

	return shapes.filter((shape) => {
		return isShapeInBounds(shape, bounds);
	});
}

// Check if shape intersects with bounds
function isShapeInBounds(shape: Shape, bounds: Bounds): boolean {
	let shapeX: number, shapeY: number, shapeWidth: number, shapeHeight: number;

	// Handle different shape types
	if (shape.type === "freedraw" && shape.points && shape.points.length > 0) {
		// Calculate bounding box for freedraw shapes
		// Note: shape.points are in absolute world coordinates
		const minX = Math.min(...shape.points.map((p: Point) => p.x));
		const minY = Math.min(...shape.points.map((p: Point) => p.y));
		const maxX = Math.max(...shape.points.map((p: Point) => p.x));
		const maxY = Math.max(...shape.points.map((p: Point) => p.y));

		// Use absolute coordinates directly (points are already in world space)
		shapeX = minX;
		shapeY = minY;
		shapeWidth = maxX - minX;
		shapeHeight = maxY - minY;
	} else if (hasWidthHeight(shape)) {
		// Shapes with explicit width and height
		shapeX = shape.x;
		shapeY = shape.y;
		shapeWidth = shape.width;
		shapeHeight = shape.height;
	} else {
		// Can't determine bounds
		return false;
	}

	return !(
		shapeX + shapeWidth < bounds.x ||
		shapeX > bounds.x + bounds.width ||
		shapeY + shapeHeight < bounds.y ||
		shapeY > bounds.y + bounds.height
	);
}

// Get resize handle at point
export function getResizeHandleAtPoint(point: Point, shapeId: string): ResizeHandle | null {
	const shape = getShape(shapeId);
	if (!shape) return null;

	let x: number, y: number, width: number, height: number;

	// Calculate actual bounds for freedraw shapes
	if (shape.type === "freedraw" && shape.points && shape.points.length > 0) {
		const minX = Math.min(...shape.points.map((p: Point) => p.x));
		const minY = Math.min(...shape.points.map((p: Point) => p.y));
		const maxX = Math.max(...shape.points.map((p: Point) => p.x));
		const maxY = Math.max(...shape.points.map((p: Point) => p.y));

		x = minX;
		y = minY;
		width = maxX - minX;
		height = maxY - minY;
	} else if (hasWidthHeight(shape)) {
		x = shape.x;
		y = shape.y;
		width = shape.width;
		height = shape.height;
	} else {
		return null;
	}

	const handleSize = 15; // Increased handle hit area size for easier clicking
	const halfHandle = handleSize / 2;

	// Define handle positions
	const handles = {
		nw: { x: x - halfHandle, y: y - halfHandle },
		n: { x: x + width / 2 - halfHandle, y: y - halfHandle },
		ne: { x: x + width - halfHandle, y: y - halfHandle },
		e: { x: x + width - halfHandle, y: y + height / 2 - halfHandle },
		se: { x: x + width - halfHandle, y: y + height - halfHandle },
		s: { x: x + width / 2 - halfHandle, y: y + height - halfHandle },
		sw: { x: x - halfHandle, y: y + height - halfHandle },
		w: { x: x - halfHandle, y: y + height / 2 - halfHandle },
	};

	// Check if point is within any handle
	for (const [handle, pos] of Object.entries(handles)) {
		if (
			point.x >= pos.x &&
			point.x <= pos.x + handleSize &&
			point.y >= pos.y &&
			point.y <= pos.y + handleSize
		) {
			return handle as ResizeHandle;
		}
	}

	return null;
}

// Get crop handle at point (not yet implemented)
export function getCropHandleAtPoint(_point: Point): any {
	// TODO: Implement actual crop handle detection
	return null;
}

// Get shape by ID
export function getShape(id: string): Shape | null {
	const state = whiteboardStore.getState();
	return state.shapes[id] || null;
}

// Update shape properties
export function updateShape(id: string, updates: Partial<Shape>): void {
	const { shapes, updateShape: updateShapeFn } = whiteboardStore.getState();
	const shape = shapes[id];
	if (shape) {
		// Updates is already Partial<Shape> which is compatible
		updateShapeFn(id, updates);
	}
}

// Create a new shape
export function createShape(shape: Partial<Shape>): void {
	// Create default rectangle shape that satisfies Shape type
	const defaultRectangle = {
		id: `shape-${Date.now()}`,
		type: "rectangle" as const,
		x: 0,
		y: 0,
		width: DEFAULT_SHAPE_SIZE.width,
		height: DEFAULT_SHAPE_SIZE.height,
		rotation: 0,
		opacity: DEFAULT_SHAPE_STYLES.opacity,
		strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
		fillColor: DEFAULT_SHAPE_STYLES.fillColor,
		strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
	} satisfies Shape;

	// Merge with provided shape properties
	// Type assertion is necessary here because Partial<Shape> could change the type field
	// which would make the result not conform to any specific Shape type
	const fullShape = {
		...defaultRectangle,
		...shape,
	} as Shape;

	whiteboardStore.getState().addShape(fullShape);
}

// Commit shape changes (currently a no-op as changes are immediate)
export function commitShapeChanges(): void {
	// Changes are committed immediately in Zustand
	// This could be used for undo/redo in the future
}

export function screenToWorld(point: Point): Point {
	// TODO: Implement actual coordinate transformation
	return point;
}

export function smoothPath(points: Point[], _factor: number): Point[] {
	// TODO: Implement actual path smoothing
	return points;
}
