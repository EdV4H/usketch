import type { Camera, Shape } from "@usketch/shared-types";
import type React from "react";
import { useShapeRegistry } from "./context";

export interface ShapeRendererProps {
	shape: Shape;
	isSelected?: boolean;
	camera: Camera;
	onClick?: (e: React.MouseEvent) => void;
	onPointerDown?: (e: React.PointerEvent) => void;
	onPointerMove?: (e: React.PointerEvent) => void;
	onPointerUp?: (e: React.PointerEvent) => void;
}

/**
 * Simplified shape renderer that uses ShapeRegistry to get components
 *
 * This replaces UnifiedShapeRenderer with a much simpler implementation:
 * - No ShapeFactory dependency
 * - No mutation of renderer state
 * - Direct component rendering from registry
 * - React handles optimization automatically
 */
export const ShapeRenderer: React.FC<ShapeRendererProps> = ({
	shape,
	isSelected = false,
	onClick,
	onPointerDown,
	onPointerMove,
	onPointerUp,
}) => {
	const { registry } = useShapeRegistry();

	// Get component directly from registry
	const ShapeComponent = registry.getComponent(shape.type);

	if (!ShapeComponent) {
		console.warn(`Unknown shape type: ${shape.type}`);
		return null;
	}

	// Render component directly - no factory, no mutation
	return (
		<ShapeComponent
			shape={shape}
			isSelected={isSelected}
			onClick={onClick}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
		/>
	);
};
