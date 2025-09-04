import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import type { ShapeLayerProps } from "../types";
import { Shape } from "./Shape";

export const ShapeLayer: React.FC<ShapeLayerProps> = ({ shapes, camera, className = "" }) => {
	const shapeArray = Object.values(shapes);
	const { selectedShapeIds, selectShape, deselectShape } = useWhiteboardStore();

	const handleShapeClick = (shapeId: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (e.shiftKey || e.metaKey) {
			if (selectedShapeIds.has(shapeId)) {
				deselectShape(shapeId);
			} else {
				selectShape(shapeId);
			}
		} else {
			selectShape(shapeId);
		}
	};

	return (
		<svg
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
			}}
		>
			<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
				{shapeArray.map((shape) => (
					<Shape
						key={shape.id}
						shape={shape}
						isSelected={selectedShapeIds.has(shape.id)}
						onClick={(e) => handleShapeClick(shape.id, e)}
					/>
				))}
			</g>
		</svg>
	);
};
