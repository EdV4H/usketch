import type { Point, Shape } from "@usketch/shared-types";
import { useWhiteboardStore, whiteboardStore } from "@usketch/store";
import { useCallback } from "react";

export const useShapeManagement = () => {
	const {
		shapes,
		selectedShapeIds,
		addShape,
		updateShape,
		deleteShapes,
		selectShapes,
		clearSelection,
	} = useWhiteboardStore();

	const createRectangle = useCallback((start: Point, end: Point): Shape => {
		const x = Math.min(start.x, end.x);
		const y = Math.min(start.y, end.y);
		const width = Math.abs(end.x - start.x);
		const height = Math.abs(end.y - start.y);

		return {
			id: `rect-${Date.now()}`,
			type: "rectangle",
			x,
			y,
			width,
			height,
			fillColor: "#ffffff",
			strokeColor: "#000000",
			strokeWidth: 2,
			opacity: 1,
			rotation: 0,
		};
	}, []);

	const createEllipse = useCallback((start: Point, end: Point): Shape => {
		const x = Math.min(start.x, end.x);
		const y = Math.min(start.y, end.y);
		const width = Math.abs(end.x - start.x);
		const height = Math.abs(end.y - start.y);

		return {
			id: `ellipse-${Date.now()}`,
			type: "ellipse",
			x,
			y,
			width,
			height,
			fillColor: "#ffffff",
			strokeColor: "#000000",
			strokeWidth: 2,
			opacity: 1,
			rotation: 0,
		};
	}, []);

	const moveSelectedShapes = useCallback(
		(delta: Point) => {
			const updates: Array<{ id: string; updates: Partial<Shape> }> = [];
			selectedShapeIds.forEach((id) => {
				const shape = shapes[id];
				if (shape) {
					updates.push({
						id,
						updates: {
							x: shape.x + delta.x,
							y: shape.y + delta.y,
						},
					});
				}
			});

			// Use batch update if multiple shapes, single update otherwise
			if (updates.length > 1 && whiteboardStore.getState().batchUpdateShapes) {
				whiteboardStore.getState().batchUpdateShapes(updates);
			} else if (updates.length === 1) {
				updateShape(updates[0].id, updates[0].updates);
			}
		},
		[shapes, selectedShapeIds, updateShape],
	);

	const getShapesAtPoint = useCallback(
		(point: Point): Shape[] => {
			return Object.values(shapes).filter((shape) => {
				const width = "width" in shape ? shape.width : 100;
				const height = "height" in shape ? shape.height : 100;
				return (
					point.x >= shape.x &&
					point.x <= shape.x + width &&
					point.y >= shape.y &&
					point.y <= shape.y + height
				);
			});
		},
		[shapes],
	);

	const getShapesInRect = useCallback(
		(rect: { x: number; y: number; width: number; height: number }): Shape[] => {
			return Object.values(shapes).filter((shape) => {
				const width = "width" in shape ? shape.width : 100;
				const height = "height" in shape ? shape.height : 100;
				const shapeRight = shape.x + width;
				const shapeBottom = shape.y + height;
				const rectRight = rect.x + rect.width;
				const rectBottom = rect.y + rect.height;

				return !(
					shapeRight < rect.x ||
					shape.x > rectRight ||
					shapeBottom < rect.y ||
					shape.y > rectBottom
				);
			});
		},
		[shapes],
	);

	return {
		shapes,
		selectedShapeIds,
		createRectangle,
		createEllipse,
		moveSelectedShapes,
		getShapesAtPoint,
		getShapesInRect,
		addShape,
		updateShape,
		deleteShapes,
		selectShapes,
		clearSelection,
	};
};
