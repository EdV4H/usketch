import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useRef } from "react";
import type { ShapeLayerProps } from "../types";
import { Shape } from "./shape";

export const ShapeLayer: React.FC<ShapeLayerProps> = ({
	shapes,
	camera,
	currentTool: _currentTool,
	className = "",
}) => {
	const { selectedShapeIds, zOrder } = useWhiteboardStore();
	const svgRef = useRef<SVGSVGElement>(null);

	// Recursive function to render a shape and its children
	const renderShapeWithChildren = (shape: (typeof shapes)[string]): React.ReactNode[] => {
		const result: React.ReactNode[] = [];

		// Skip if shape is invisible
		const isVisible = shape.layer?.visible ?? true;
		if (!isVisible) return result;

		// Skip if parent group is invisible
		if (shape.layer?.parentId) {
			const parentGroupShape = shapes[shape.layer.parentId];
			if (parentGroupShape && parentGroupShape.type === "group") {
				const isParentVisible = parentGroupShape.layer?.visible ?? true;
				if (!isParentVisible) {
					return result;
				}
			}
		}

		// If it's a group, render its children first (in order)
		if (shape.type === "group" && shape.childIds) {
			for (const childId of shape.childIds) {
				const childShape = shapes[childId];
				if (childShape) {
					result.push(...renderShapeWithChildren(childShape));
				}
			}
		} else {
			// Render the shape itself
			result.push(
				<Shape key={shape.id} shape={shape} isSelected={selectedShapeIds.has(shape.id)} />,
			);
		}

		return result;
	};

	// Build shape array in zOrder (back to front for correct layering)
	const orderedShapes = zOrder.map((id) => shapes[id]).filter((shape) => shape !== undefined);

	// Note: Event handling has been moved to InteractionLayer with ToolManager integration
	// ShapeLayer now only renders shapes and does not handle pointer events

	return (
		<svg
			ref={svgRef}
			className={`shape-layer ${className}`.trim()}
			data-testid="shape-layer"
			role="img"
			aria-label="Shape layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
				pointerEvents: "none", // Let InteractionLayer handle all events
			}}
		>
			<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
				{/* Invisible background rect (no longer captures events) */}
				<rect
					data-background="true"
					x={-10000}
					y={-10000}
					width={20000}
					height={20000}
					fill="transparent"
				/>

				{/* Render shapes in zOrder with children (skip invisible shapes) */}
				{orderedShapes.flatMap((shape) => renderShapeWithChildren(shape))}
			</g>
		</svg>
	);
};
