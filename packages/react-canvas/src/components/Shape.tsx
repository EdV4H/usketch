import { useShapePlugin } from "@usketch/shape-registry";
import type { Shape as ShapeType } from "@usketch/shared-types";
import React from "react";

interface ShapeProps {
	shape: ShapeType;
	isSelected?: boolean;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

/**
 * Dynamic shape component that renders based on registered plugins
 */
export const Shape: React.FC<ShapeProps> = React.memo(
	({ shape, isSelected = false, onClick, onPointerDown, onPointerMove, onPointerUp }) => {
		// Get the plugin for this shape type
		const plugin = useShapePlugin(shape.type);

		if (!plugin) {
			if (process.env.NODE_ENV === "development") {
				console.warn(`No plugin registered for shape type: ${shape.type}`);
			}
			return null;
		}

		const Component = plugin.component;

		return (
			<Component
				shape={shape}
				isSelected={isSelected}
				onClick={onClick}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
			/>
		);
	},
);

Shape.displayName = "Shape";
