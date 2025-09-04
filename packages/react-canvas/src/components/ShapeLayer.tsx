import { useWhiteboardStore, whiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import type { ShapeLayerProps } from "../types";
import { Shape } from "./Shape";

export const ShapeLayer: React.FC<ShapeLayerProps> = ({
	shapes,
	camera,
	activeTool,
	className = "",
}) => {
	const shapeArray = Object.values(shapes);
	const { selectedShapeIds, selectShape, deselectShape, updateShape } = useWhiteboardStore();
	const [dragState, setDragState] = useState<{
		isDragging: boolean;
		draggedShapeId: string | null;
		startX: number;
		startY: number;
		originalX: number;
		originalY: number;
	}>({ isDragging: false, draggedShapeId: null, startX: 0, startY: 0, originalX: 0, originalY: 0 });

	const handleShapeClick = (shapeId: string, e: React.MouseEvent) => {
		// Only handle clicks when select tool is active
		if (activeTool !== "select") return;

		e.stopPropagation();
		if (e.shiftKey || e.metaKey) {
			// Multiple selection mode
			if (selectedShapeIds.has(shapeId)) {
				deselectShape(shapeId);
			} else {
				selectShape(shapeId);
			}
		} else {
			// Single selection mode - clear others and select only this shape
			const store = whiteboardStore.getState();
			store.setSelection([shapeId]);
		}
	};

	const handleShapePointerDown = useCallback(
		(shapeId: string, e: React.PointerEvent) => {
			if (activeTool !== "select") return;
			if (!selectedShapeIds.has(shapeId)) return;

			const shape = shapes[shapeId];
			if (!shape) return;

			// Start dragging
			// Get the parent SVG element's bounding rect
			const svgElement = (e.currentTarget as SVGElement).ownerSVGElement;
			if (!svgElement) return;
			const rect = svgElement.getBoundingClientRect();
			const x = (e.clientX - rect.left - camera.x) / camera.zoom;
			const y = (e.clientY - rect.top - camera.y) / camera.zoom;

			setDragState({
				isDragging: true,
				draggedShapeId: shapeId,
				startX: x,
				startY: y,
				originalX: shape.x,
				originalY: shape.y,
			});

			e.currentTarget.setPointerCapture(e.pointerId);
			e.preventDefault();
		},
		[activeTool, selectedShapeIds, shapes, camera],
	);

	const handleShapePointerMove = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (!dragState.isDragging || !dragState.draggedShapeId) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const x = (e.clientX - rect.left - camera.x) / camera.zoom;
			const y = (e.clientY - rect.top - camera.y) / camera.zoom;

			const dx = x - dragState.startX;
			const dy = y - dragState.startY;

			updateShape(dragState.draggedShapeId, {
				x: dragState.originalX + dx,
				y: dragState.originalY + dy,
			});
		},
		[dragState, camera, updateShape],
	);

	const handleShapePointerUp = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (!dragState.isDragging) return;

			setDragState({
				isDragging: false,
				draggedShapeId: null,
				startX: 0,
				startY: 0,
				originalX: 0,
				originalY: 0,
			});

			e.currentTarget.releasePointerCapture(e.pointerId);
		},
		[dragState],
	);

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
				cursor: dragState.isDragging ? "grabbing" : "default",
			}}
			onPointerMove={handleShapePointerMove}
			onPointerUp={handleShapePointerUp}
		>
			<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
				{shapeArray.map((shape) => (
					<Shape
						key={shape.id}
						shape={shape}
						isSelected={selectedShapeIds.has(shape.id)}
						onClick={(e) => handleShapeClick(shape.id, e)}
						onPointerDown={(e) => handleShapePointerDown(shape.id, e)}
					/>
				))}
			</g>
		</svg>
	);
};
