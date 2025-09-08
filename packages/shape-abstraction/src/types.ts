import type { Bounds, Camera, Point, Shape } from "@usketch/shared-types";
import type React from "react";

export type RenderMode = "svg" | "html" | "hybrid";

export interface BaseShapeConfig<T extends Shape = Shape> {
	type: string;
	renderMode?: RenderMode;
	enableInteractivity?: boolean;
}

export interface ShapeRenderer<T extends Shape = Shape> {
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

export interface ShapeRendererConstructor<T extends Shape = Shape> {
	new (shape: T, config: BaseShapeConfig<T>): ShapeRenderer<T>;
}
