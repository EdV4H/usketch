import type { BaseShape, Point } from "@usketch/shared-types";
import type { ComponentType } from "react";

/**
 * Bounds representing the rectangular area of a shape
 */
export interface Bounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Props for creating a new shape
 */
export interface CreateShapeProps {
	id: string;
	x: number;
	y: number;
	[key: string]: any;
}

/**
 * Props for shape components
 */
export interface ShapeComponentProps<T extends MinimalShape = BaseShape> {
	shape: T;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

/**
 * Props for tool components
 */
export interface ToolProps {
	isActive: boolean;
	onActivate?: () => void;
	onDeactivate?: () => void;
}

/**
 * Minimal shape interface that all shapes must satisfy
 */
export interface MinimalShape {
	id: string;
	type: string;
	x: number;
	y: number;
}

/**
 * Shape plugin definition
 */
export interface ShapePlugin<T extends MinimalShape = BaseShape> {
	/** Unique identifier for the shape type */
	type: string;

	/** Display name for the shape */
	name?: string;

	/** React component for rendering the shape */
	component: ComponentType<ShapeComponentProps<T>>;

	/** Optional tool component for creating/editing the shape */
	toolComponent?: ComponentType<ToolProps>;

	/** Optional icon component for UI */
	icon?: ComponentType;

	/** Create a default shape with initial properties */
	createDefaultShape: (props: CreateShapeProps) => T;

	/** Get the bounding box of the shape */
	getBounds: (shape: T) => Bounds;

	/** Test if a point is inside the shape */
	hitTest: (shape: T, point: Point) => boolean;

	/** Optional: Serialize shape data for storage */
	serialize?: (shape: T) => any;

	/** Optional: Deserialize shape data from storage */
	deserialize?: (data: any) => T;

	/** Optional: Validate shape data */
	validate?: (shape: T) => boolean;

	/** Optional: Get resize handles for the shape */
	getResizeHandles?: (shape: T) => Point[];

	/** Optional: Get rotation handle position */
	getRotationHandle?: (shape: T) => Point;
}

/**
 * Registry event types
 */
export type RegistryEventType = "register" | "unregister" | "update";

/**
 * Registry event
 */
export interface RegistryEvent {
	type: RegistryEventType;
	shapeType: string;
	plugin?: ShapePlugin;
}

/**
 * Registry event listener
 */
export type RegistryEventListener = (event: RegistryEvent) => void;
