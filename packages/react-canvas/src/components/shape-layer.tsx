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

	// Sort shapes by zOrder (back to front)
	const shapeArray = zOrder
		? zOrder.map((id) => shapes[id]).filter((shape) => shape !== undefined)
		: Object.values(shapes);

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

				{/* Render shapes (filter out invisible shapes) */}
				{shapeArray
					.filter((shape) => shape.layer?.visible !== false)
					.map((shape) => (
						<Shape key={shape.id} shape={shape} isSelected={selectedShapeIds.has(shape.id)} />
					))}
			</g>
		</svg>
	);
};
