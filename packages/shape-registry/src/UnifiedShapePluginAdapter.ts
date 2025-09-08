import type { ShapeRenderer, ShapeRendererConstructor } from "@usketch/shape-abstraction";
import { type BaseShape as BaseShapeClass, ShapeFactory } from "@usketch/shape-abstraction";
import type { BaseShape, Shape } from "@usketch/shared-types";
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

		return {
			type: config.type,
			name: config.name,

			// Component that bridges the old and new systems
			component: (props: ShapeComponentProps<T>) => {
				const { shape, isSelected, onClick, onPointerDown, onPointerMove, onPointerUp } = props;

				// Create a renderer instance
				const renderer = ShapeFactory.create(shape as any) as any;

				// Update renderer state
				renderer.isSelected = isSelected || false;
				renderer.shape = shape;

				// Handle events if provided by the renderer
				const handlePointerDown = (e: React.PointerEvent) => {
					if (renderer.onPointerDown) {
						renderer.onPointerDown(e);
					}
					if (onPointerDown) {
						onPointerDown(e);
					}
				};

				const handlePointerMove = (e: React.PointerEvent) => {
					if (renderer.onPointerMove) {
						renderer.onPointerMove(e);
					}
					if (onPointerMove) {
						onPointerMove(e);
					}
				};

				const handlePointerUp = (e: React.PointerEvent) => {
					if (renderer.onPointerUp) {
						renderer.onPointerUp(e);
					}
					if (onPointerUp) {
						onPointerUp(e);
					}
				};

				// Clone element with event handlers
				const element = renderer.render();
				if (React.isValidElement(element)) {
					return React.cloneElement(element as React.ReactElement<any>, {
						onClick,
						onPointerDown: handlePointerDown,
						onPointerMove: handlePointerMove,
						onPointerUp: handlePointerUp,
						"data-shape-id": shape.id,
						"data-shape-type": shape.type,
					});
				}

				return element;
			},

			createDefaultShape: config.createDefaultShape,

			getBounds: (shape: T) => {
				const renderer = ShapeFactory.create(shape as any) as any;
				return renderer.getBounds();
			},

			hitTest: (shape: T, point: { x: number; y: number }) => {
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
