import type { ShapeRenderer, ShapeRendererConstructor } from "@usketch/shape-abstraction";
import { type BaseShape as BaseShapeClass, ShapeFactory, UnifiedShapeRenderer } from "@usketch/shape-abstraction";
import type { BaseShape, Camera, Shape } from "@usketch/shared-types";
import { useWhiteboardStore, whiteboardStore } from "@usketch/store";
import React from "react";
import type { ShapeComponentProps, ShapePlugin } from "./types";

/**
 * Adapter to convert BaseShape-based shapes to ShapePlugin format
 * This allows new unified shape abstraction layer to work with existing ShapeRegistry
 */
export class UnifiedShapePluginAdapter {
	/**
	 * Convert a BaseShape class to a ShapePlugin
	 */
	static createPlugin<T extends BaseShape = BaseShape>(
		ShapeClass: ShapeRendererConstructor<any>,
		config: {
			type: string;
			name?: string;
			createDefaultShape: (props: any) => T;
		},
	): ShapePlugin<T> {
		// Register the shape with ShapeFactory for unified rendering
		ShapeFactory.register(config.type, ShapeClass as ShapeRendererConstructor<Shape>);
		console.log(`[UnifiedShapePluginAdapter] Registered shape type: ${config.type}`);

		return {
			type: config.type,
			name: config.name,

			// Component that bridges the old and new systems
			component: (props: ShapeComponentProps<T>) => {
				const { shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp } = props;
				
				// Get camera from store using React hook for reactive updates
				const camera = useWhiteboardStore((state) => state.camera);
				
				console.log(`[UnifiedShapePluginAdapter] Rendering component for ${shape.type} at (${shape.x}, ${shape.y})`);

				// Ensure the shape is registered (in case of lazy loading)
				if (!ShapeFactory.has(config.type)) {
					console.log(`[UnifiedShapePluginAdapter] Re-registering ${config.type}`);
					ShapeFactory.register(config.type, ShapeClass as ShapeRendererConstructor<Shape>);
				}

				// Use UnifiedShapeRenderer which handles different render modes properly
				return (
					<UnifiedShapeRenderer
						shape={shape as unknown as Shape}
						isSelected={isSelected || false}
						camera={camera}
						onClick={onClick}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
					/>
				);
			},

			createDefaultShape: config.createDefaultShape,

			getBounds: (shape: T) => {
				// Ensure the shape is registered
				if (!ShapeFactory.has(config.type)) {
					ShapeFactory.register(config.type, ShapeClass as ShapeRendererConstructor<Shape>);
				}
				const renderer = ShapeFactory.create(shape as any) as any;
				const bounds = renderer.getBounds();
				console.log(`[UnifiedShapePluginAdapter] getBounds for ${shape.type}:`, bounds, 'shape:', shape);
				return bounds;
			},

			hitTest: (shape: T, point: { x: number; y: number }) => {
				// Ensure the shape is registered
				if (!ShapeFactory.has(config.type)) {
					ShapeFactory.register(config.type, ShapeClass as ShapeRendererConstructor<Shape>);
				}
				const renderer = ShapeFactory.create(shape as any) as any;
				return renderer.hitTest(point);
			},
		};
	}

	/**
	 * Create plugin from existing BaseShape instance
	 */
	static fromBaseShape<T extends BaseShape = BaseShape>(
		type: string,
		ShapeClass: new (shape: any, config: any) => BaseShapeClass<any>,
		createDefaultShape: (props: any) => T,
		name?: string,
	): ShapePlugin<T> {
		return UnifiedShapePluginAdapter.createPlugin(ShapeClass as any, {
			type,
			name,
			createDefaultShape,
		});
	}
}
