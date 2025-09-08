import type { Bounds, Camera, Point } from "@usketch/shared-types";
import type React from "react";

export type RenderMode = "svg" | "html" | "hybrid";

// Minimal shape interface for flexibility
interface MinimalShape {
	id: string;
	type: string;
	x: number;
	y: number;
}

export interface BaseShapeConfig<T extends MinimalShape = MinimalShape> {
	type: string;
	renderMode?: RenderMode;
	enableInteractivity?: boolean;
	onUpdate?: (shape: T) => void;
}

export interface ShapeRenderer<T extends MinimalShape = MinimalShape> {
	shape: T;
	camera: Camera;
	isSelected: boolean;

	render(): React.ReactElement;
	getBounds(): Bounds;
	hitTest(point: Point): boolean;
	getRenderMode(): RenderMode;
	isInteractive(): boolean;

	onPointerDown?(e: React.PointerEvent): void;
	onPointerMove?(e: React.PointerEvent): void;
	onPointerUp?(e: React.PointerEvent): void;
	onDrag?(delta: Point): void;
	onResize?(handle: ResizeHandle, delta: Point): void;
}

export type ResizeHandle =
	| "top-left"
	| "top"
	| "top-right"
	| "right"
	| "bottom-right"
	| "bottom"
	| "bottom-left"
	| "left";

export interface ShapeRendererConstructor<T extends MinimalShape = MinimalShape> {
	new (shape: T, config: BaseShapeConfig<T>): ShapeRenderer<T>;
}
