import type { Bounds, Camera, Point } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import type React from "react";
import type { BaseShapeConfig, ResizeHandle, ShapeRenderer } from "./types";

// Allow any shape type that has at least id, type, x, y
interface MinimalShape {
	id: string;
	type: string;
	x: number;
	y: number;
}

export abstract class BaseShape<T extends MinimalShape = MinimalShape> implements ShapeRenderer<T> {
	public shape: T;
	public camera: Camera;
	public isSelected: boolean;
	protected config: BaseShapeConfig<T>;

	constructor(shape: T, config: BaseShapeConfig<T>) {
		this.shape = shape;
		this.config = config;
		this.camera = { x: 0, y: 0, zoom: 1 };
		this.isSelected = false;
	}

	// Abstract methods that must be implemented by subclasses
	abstract render(): React.ReactElement;
	abstract getBounds(): Bounds;
	abstract hitTest(point: Point): boolean;

	// Optional methods with default implementations
	onPointerDown?(e: React.PointerEvent): void;
	onPointerMove?(e: React.PointerEvent): void;
	onPointerUp?(e: React.PointerEvent): void;

	onDrag?(delta: Point): void {
		// Default drag implementation
		this.updateShape({
			x: this.shape.x + delta.x,
			y: this.shape.y + delta.y,
		} as Partial<T>);
	}

	onResize?(handle: ResizeHandle, delta: Point): void {
		// Default resize implementation for shapes with width/height
		if ("width" in this.shape && "height" in this.shape) {
			const updates: Partial<T> = {} as Partial<T>;

			switch (handle) {
				case "right":
					(updates as any).width = (this.shape as any).width + delta.x;
					break;
				case "bottom":
					(updates as any).height = (this.shape as any).height + delta.y;
					break;
				case "bottom-right":
					(updates as any).width = (this.shape as any).width + delta.x;
					(updates as any).height = (this.shape as any).height + delta.y;
					break;
				// Add more handle cases as needed
			}

			this.updateShape(updates);
		}
	}

	// Utility methods available to all shapes
	protected getScreenCoordinates(): Point {
		return this.transformToScreen({ x: this.shape.x, y: this.shape.y });
	}

	protected transformToScreen(point: Point): Point {
		return {
			x: point.x * this.camera.zoom + this.camera.x,
			y: point.y * this.camera.zoom + this.camera.y,
		};
	}

	protected transformToWorld(point: Point): Point {
		return {
			x: (point.x - this.camera.x) / this.camera.zoom,
			y: (point.y - this.camera.y) / this.camera.zoom,
		};
	}

	protected updateShape(updates: Partial<T>): void {
		whiteboardStore.getState().updateShape(this.shape.id, updates);
	}

	protected getSelectionStyle(): React.CSSProperties {
		return this.isSelected
			? {
					outline: "2px solid #0066FF",
					outlineOffset: "2px",
				}
			: {};
	}

	getRenderMode(): "svg" | "html" | "hybrid" {
		return this.config.renderMode || "svg";
	}

	isInteractive(): boolean {
		return this.config.enableInteractivity || false;
	}
}
