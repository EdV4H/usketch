import type {
	AlignmentGuide,
	AlignmentOptions,
	AlignmentPoint,
	AlignmentResult,
	Bounds,
	Shape,
} from "@usketch/shared-types";

export class AlignmentEngine {
	private readonly defaultSnapThreshold = 8;
	private readonly defaultStrongSnapThreshold = 15;

	calculateAlignments(
		movingShape: Shape,
		targetShapes: Shape[],
		options: AlignmentOptions,
	): AlignmentResult {
		if (!options.snapEnabled) {
			return {
				snappedPosition: { x: movingShape.x, y: movingShape.y },
				guides: [],
				didSnap: false,
			};
		}

		const threshold = options.isStrongSnap ? options.strongSnapThreshold : options.snapThreshold;

		const movingPoints = this.getAlignmentPoints(movingShape);
		const targetPoints: AlignmentPoint[] = [];

		for (const targetShape of targetShapes) {
			if (options.excludeShapeIds?.includes(targetShape.id)) {
				continue;
			}
			targetPoints.push(...this.getAlignmentPoints(targetShape));
		}

		const guides: AlignmentGuide[] = [];
		let snappedX = movingShape.x;
		let snappedY = movingShape.y;
		let didSnapX = false;
		let didSnapY = false;

		// Check vertical alignment (x-axis)
		for (const movingPoint of movingPoints) {
			const currentX = movingPoint.x;
			for (const targetPoint of targetPoints) {
				const distance = Math.abs(currentX - targetPoint.x);
				if (distance <= threshold) {
					if (!didSnapX) {
						const offset = targetPoint.x - currentX;
						snappedX = movingShape.x + offset;
						didSnapX = true;

						// Create vertical guide
						const alignedShapes = [movingShape.id, targetPoint.shapeId];
						const guide: AlignmentGuide = {
							id: `vertical-${targetPoint.x}`,
							type: "vertical",
							position: targetPoint.x,
							start: { x: targetPoint.x, y: Math.min(movingPoint.y, targetPoint.y) - 50 },
							end: { x: targetPoint.x, y: Math.max(movingPoint.y, targetPoint.y) + 50 },
							alignedShapes,
						};
						guides.push(guide);
					}
				}
			}
		}

		// Check horizontal alignment (y-axis)
		for (const movingPoint of movingPoints) {
			const currentY = movingPoint.y;
			for (const targetPoint of targetPoints) {
				const distance = Math.abs(currentY - targetPoint.y);
				if (distance <= threshold) {
					if (!didSnapY) {
						const offset = targetPoint.y - currentY;
						snappedY = movingShape.y + offset;
						didSnapY = true;

						// Create horizontal guide
						const alignedShapes = [movingShape.id, targetPoint.shapeId];
						const guide: AlignmentGuide = {
							id: `horizontal-${targetPoint.y}`,
							type: "horizontal",
							position: targetPoint.y,
							start: { x: Math.min(movingPoint.x, targetPoint.x) - 50, y: targetPoint.y },
							end: { x: Math.max(movingPoint.x, targetPoint.x) + 50, y: targetPoint.y },
							alignedShapes,
						};
						guides.push(guide);
					}
				}
			}
		}

		return {
			snappedPosition: { x: snappedX, y: snappedY },
			guides,
			didSnap: didSnapX || didSnapY,
		};
	}

	private getAlignmentPoints(shape: Shape): AlignmentPoint[] {
		const bounds = this.getShapeBounds(shape);
		const points: AlignmentPoint[] = [];

		// Vertical alignment points
		points.push({
			x: bounds.x,
			y: bounds.y + bounds.height / 2,
			type: "left",
			shapeId: shape.id,
		});
		points.push({
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2,
			type: "center-horizontal",
			shapeId: shape.id,
		});
		points.push({
			x: bounds.x + bounds.width,
			y: bounds.y + bounds.height / 2,
			type: "right",
			shapeId: shape.id,
		});

		// Horizontal alignment points
		points.push({
			x: bounds.x + bounds.width / 2,
			y: bounds.y,
			type: "top",
			shapeId: shape.id,
		});
		points.push({
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2,
			type: "center-vertical",
			shapeId: shape.id,
		});
		points.push({
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height,
			type: "bottom",
			shapeId: shape.id,
		});

		return points;
	}

	private getShapeBounds(shape: Shape): Bounds {
		switch (shape.type) {
			case "rectangle":
			case "ellipse":
			case "freedraw":
				return {
					x: shape.x,
					y: shape.y,
					width: shape.width,
					height: shape.height,
				};
			case "line":
				return {
					x: Math.min(shape.x, shape.x2),
					y: Math.min(shape.y, shape.y2),
					width: Math.abs(shape.x2 - shape.x),
					height: Math.abs(shape.y2 - shape.y),
				};
			case "text":
				// Approximate text bounds
				return {
					x: shape.x,
					y: shape.y,
					width: shape.text.length * shape.fontSize * 0.6,
					height: shape.fontSize * 1.2,
				};
			default: {
				// This should never happen if all shape types are handled
				const _exhaustiveCheck: never = shape;
				return {
					x: 0,
					y: 0,
					width: 0,
					height: 0,
				};
			}
		}
	}
}
