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
	const shapeArray = Object.values(shapes);
	const { selectedShapeIds } = useWhiteboardStore();
	const svgRef = useRef<SVGSVGElement>(null);

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
				pointerEvents: "auto", // Allow foreignObject to receive events
			}}
		>
			<g
				transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}
				style={{ pointerEvents: "none" } as React.CSSProperties}
			>
				{/* Invisible background rect (no longer captures events) */}
				<rect
					data-background="true"
					x={-10000}
					y={-10000}
					width={20000}
					height={20000}
					fill="transparent"
				/>

				{/* Render shapes */}
				{shapeArray.map((shape) => (
					<Shape key={shape.id} shape={shape} isSelected={selectedShapeIds.has(shape.id)} />
				))}
			</g>
		</svg>
	);
};
