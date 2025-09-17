// === Snap Engine for alignment assistance ===

import type { Point, Shape } from "../types/index";

export interface SnapOptions {
	snapEnabled?: boolean;
	gridSnap?: boolean;
	shapeSnap?: boolean;
	gridSize?: number;
	snapThreshold?: number;
}

export interface SnapResult {
	position: Point;
	guides?: SnapGuide[];
	snapped: boolean;
}

export interface SnapGuide {
	type: "horizontal" | "vertical" | "distance";
	position: number;
	start: Point;
	end: Point;
	// Smart guide specific properties
	distance?: number; // Distance value to display
	label?: string; // Optional label for the guide
	style?: "solid" | "dashed" | "dotted"; // Line style
}

export type AlignmentType =
	| "left"
	| "center-horizontal"
	| "right"
	| "top"
	| "center-vertical"
	| "bottom";

export type DistributionType = "horizontal" | "vertical";

// Constants for smart guides
const MAX_GUIDE_DISTANCE = 100; // Maximum distance to show distance guides
const ALIGNMENT_THRESHOLD = 5; // Threshold for detecting alignment

export class SnapEngine {
	private gridSize = 20;
	private snapThreshold = 15;
	private activeGuides: SnapGuide[] = [];

	constructor(gridSize = 20, snapThreshold = 15) {
		this.gridSize = gridSize;
		this.snapThreshold = snapThreshold;
	}

	// Basic grid snapping
	snap(position: Point, options?: SnapOptions): SnapResult {
		if (!options?.snapEnabled) {
			return { position, snapped: false };
		}

		const snappedPosition = { ...position };
		let snapped = false;

		if (options.gridSnap) {
			const gridX = Math.round(position.x / this.gridSize) * this.gridSize;
			const gridY = Math.round(position.y / this.gridSize) * this.gridSize;

			const deltaX = Math.abs(position.x - gridX);
			const deltaY = Math.abs(position.y - gridY);

			// Only snap if within threshold
			if (deltaX < this.snapThreshold) {
				snappedPosition.x = gridX;
				snapped = true;
			}
			if (deltaY < this.snapThreshold) {
				snappedPosition.y = gridY;
				snapped = true;
			}
		}

		return {
			position: snappedPosition,
			guides: snapped ? this.activeGuides : [],
			snapped,
		};
	}

	// Snap to other shapes
	snapToShapes(
		movingShape: { x: number; y: number; width?: number; height?: number },
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
		currentPosition: Point,
	): SnapResult {
		const snapPoints = this.findSnapPoints(movingShape, targetShapes, currentPosition);
		const { position: snappedPosition, activeSnapPoints } = this.calculateSnappedPositionWithActive(
			currentPosition,
			snapPoints,
		);

		const snapped =
			snappedPosition.x !== currentPosition.x || snappedPosition.y !== currentPosition.y;

		return {
			position: snappedPosition,
			guides: snapped
				? this.generateGuidesFromActivePoints(activeSnapPoints, movingShape, targetShapes)
				: [],
			snapped,
		};
	}

	private findSnapPoints(
		movingShape: { x: number; y: number; width?: number; height?: number },
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
		_currentPosition: Point,
	): Array<{
		axis: "x" | "y";
		value: number;
		priority: number;
		targetId?: string;
		edgeType?: string;
		targetPosition?: number;
	}> {
		const snapPoints: Array<{
			axis: "x" | "y";
			value: number;
			priority: number;
			targetId?: string;
			edgeType?: string;
			targetPosition?: number;
		}> = [];
		const width = movingShape.width || 0;
		const height = movingShape.height || 0;

		targetShapes.forEach((target) => {
			if (!target) return;

			const targetWidth = target.width;
			const targetHeight = target.height;
			const targetId = target.id;

			// Horizontal snap points (x-axis)
			// Left edge to left edge
			snapPoints.push({
				axis: "x",
				value: target.x,
				priority: 1,
				targetId,
				edgeType: "left-to-left",
				targetPosition: target.x,
			});
			// Right edge to right edge
			snapPoints.push({
				axis: "x",
				value: target.x + targetWidth - width,
				priority: 1,
				targetId,
				edgeType: "right-to-right",
				targetPosition: target.x + targetWidth,
			});
			// Left edge to right edge
			snapPoints.push({
				axis: "x",
				value: target.x + targetWidth,
				priority: 2,
				targetId,
				edgeType: "left-to-right",
				targetPosition: target.x + targetWidth,
			});
			// Right edge to left edge
			snapPoints.push({
				axis: "x",
				value: target.x - width,
				priority: 2,
				targetId,
				edgeType: "right-to-left",
				targetPosition: target.x,
			});
			// Center to center
			const targetCenterX = target.x + targetWidth / 2;
			snapPoints.push({
				axis: "x",
				value: targetCenterX - width / 2,
				priority: 3,
				targetId,
				edgeType: "center-to-center",
				targetPosition: targetCenterX,
			});

			// Corner snapping (x-axis)
			// Top-left corner to top-left
			snapPoints.push({
				axis: "x",
				value: target.x,
				priority: 2,
				targetId,
				edgeType: "corner-tl-to-tl",
				targetPosition: target.x,
			});
			// Top-right corner to top-right
			snapPoints.push({
				axis: "x",
				value: target.x + targetWidth - width,
				priority: 2,
				targetId,
				edgeType: "corner-tr-to-tr",
				targetPosition: target.x + targetWidth,
			});
			// Bottom-left corner to bottom-left
			snapPoints.push({
				axis: "x",
				value: target.x,
				priority: 2,
				targetId,
				edgeType: "corner-bl-to-bl",
				targetPosition: target.x,
			});
			// Bottom-right corner to bottom-right
			snapPoints.push({
				axis: "x",
				value: target.x + targetWidth - width,
				priority: 2,
				targetId,
				edgeType: "corner-br-to-br",
				targetPosition: target.x + targetWidth,
			});

			// Vertical snap points (y-axis)
			// Top edge to top edge
			snapPoints.push({
				axis: "y",
				value: target.y,
				priority: 1,
				targetId,
				edgeType: "top-to-top",
				targetPosition: target.y,
			});
			// Bottom edge to bottom edge
			snapPoints.push({
				axis: "y",
				value: target.y + targetHeight - height,
				priority: 1,
				targetId,
				edgeType: "bottom-to-bottom",
				targetPosition: target.y + targetHeight,
			});
			// Top edge to bottom edge
			snapPoints.push({
				axis: "y",
				value: target.y + targetHeight,
				priority: 2,
				targetId,
				edgeType: "top-to-bottom",
				targetPosition: target.y + targetHeight,
			});
			// Bottom edge to top edge
			snapPoints.push({
				axis: "y",
				value: target.y - height,
				priority: 2,
				targetId,
				edgeType: "bottom-to-top",
				targetPosition: target.y,
			});
			// Center to center
			const targetCenterY = target.y + targetHeight / 2;
			snapPoints.push({
				axis: "y",
				value: targetCenterY - height / 2,
				priority: 3,
				targetId,
				edgeType: "center-to-center",
				targetPosition: targetCenterY,
			});

			// Corner snapping (y-axis)
			// Top-left corner to top-left
			snapPoints.push({
				axis: "y",
				value: target.y,
				priority: 2,
				targetId,
				edgeType: "corner-tl-to-tl",
				targetPosition: target.y,
			});
			// Top-right corner to top-right
			snapPoints.push({
				axis: "y",
				value: target.y,
				priority: 2,
				targetId,
				edgeType: "corner-tr-to-tr",
				targetPosition: target.y,
			});
			// Bottom-left corner to bottom-left
			snapPoints.push({
				axis: "y",
				value: target.y + targetHeight - height,
				priority: 2,
				targetId,
				edgeType: "corner-bl-to-bl",
				targetPosition: target.y + targetHeight,
			});
			// Bottom-right corner to bottom-right
			snapPoints.push({
				axis: "y",
				value: target.y + targetHeight - height,
				priority: 2,
				targetId,
				edgeType: "corner-br-to-br",
				targetPosition: target.y + targetHeight,
			});
		});

		return snapPoints;
	}

	private calculateSnappedPositionWithActive(
		currentPosition: Point,
		snapPoints: Array<{
			axis: "x" | "y";
			value: number;
			priority: number;
			targetId?: string;
			edgeType?: string;
		}>,
	): {
		position: Point;
		activeSnapPoints: Array<{
			axis: "x" | "y";
			value: number;
			priority: number;
			targetId?: string;
			edgeType?: string;
		}>;
	} {
		const snappedPosition = { ...currentPosition };
		const activeSnapPoints: Array<{
			axis: "x" | "y";
			value: number;
			priority: number;
			targetId?: string;
			edgeType?: string;
		}> = [];

		// Find closest snap point for each axis
		const xSnapPoints = snapPoints.filter((p) => p.axis === "x");
		const ySnapPoints = snapPoints.filter((p) => p.axis === "y");

		// Snap X axis
		if (xSnapPoints.length > 0) {
			const closest = this.findClosestSnapPoint(currentPosition.x, xSnapPoints);
			if (closest && Math.abs(currentPosition.x - closest.value) < this.snapThreshold) {
				snappedPosition.x = closest.value;
				activeSnapPoints.push({ ...closest, axis: "x" });
			}
		}

		// Snap Y axis
		if (ySnapPoints.length > 0) {
			const closest = this.findClosestSnapPoint(currentPosition.y, ySnapPoints);
			if (closest && Math.abs(currentPosition.y - closest.value) < this.snapThreshold) {
				snappedPosition.y = closest.value;
				activeSnapPoints.push({ ...closest, axis: "y" });
			}
		}

		return { position: snappedPosition, activeSnapPoints };
	}

	private findClosestSnapPoint<T extends { value: number; priority: number }>(
		value: number,
		snapPoints: Array<T>,
	): T | null {
		if (snapPoints.length === 0) return null;

		// Calculate weighted score for each snap point
		const scoredPoints = snapPoints
			.map((point) => {
				const distance = Math.abs(value - point.value);
				// Only consider points within threshold
				if (distance >= this.snapThreshold) return null;

				// Calculate score: lower priority and closer distance = better score
				// Priority weight: 1.0 for priority 1, 1.5 for priority 2, 2.0 for priority 3
				const priorityWeight = 0.5 + point.priority * 0.5;
				// Distance weight: normalized from 0 to 1
				const distanceWeight = distance / this.snapThreshold;
				// Combined score (lower is better)
				const score = priorityWeight * (1 + distanceWeight);

				return {
					...point,
					distance,
					score,
				};
			})
			.filter((point): point is NonNullable<typeof point> => point !== null)
			.sort((a, b) => {
				// Sort by score (lower is better)
				if (Math.abs(a.score - b.score) > 0.01) {
					return a.score - b.score;
				}
				// If scores are very close, prefer smaller distance
				return a.distance - b.distance;
			});

		return scoredPoints[0] || null;
	}

	private generateGuidesFromActivePoints(
		activeSnapPoints: Array<{
			axis: "x" | "y";
			value: number;
			priority: number;
			targetId?: string;
			edgeType?: string;
			targetPosition?: number;
		}>,
		_movingShape: { x: number; y: number; width?: number; height?: number },
		_targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		activeSnapPoints.forEach((snapPoint) => {
			if (snapPoint.targetPosition !== undefined) {
				// Use the actual target position for the guide
				if (snapPoint.axis === "x") {
					guides.push({
						type: "vertical",
						position: snapPoint.targetPosition,
						start: { x: snapPoint.targetPosition, y: -1000 },
						end: { x: snapPoint.targetPosition, y: 1000 },
						style: "dashed",
					});
				} else if (snapPoint.axis === "y") {
					guides.push({
						type: "horizontal",
						position: snapPoint.targetPosition,
						start: { x: -1000, y: snapPoint.targetPosition },
						end: { x: 1000, y: snapPoint.targetPosition },
						style: "dashed",
					});
				}
			} else {
				// Fallback to the snap value if no target position
				if (snapPoint.axis === "x") {
					guides.push({
						type: "vertical",
						position: snapPoint.value,
						start: { x: snapPoint.value, y: -1000 },
						end: { x: snapPoint.value, y: 1000 },
						style: "dashed",
					});
				} else if (snapPoint.axis === "y") {
					guides.push({
						type: "horizontal",
						position: snapPoint.value,
						start: { x: -1000, y: snapPoint.value },
						end: { x: 1000, y: snapPoint.value },
						style: "dashed",
					});
				}
			}
		});

		return guides;
	}

	// Generate smart guides with distance indicators
	generateSmartGuides(
		movingShape: { x: number; y: number; width: number; height: number },
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		// Check for equal spacing between shapes
		const equalSpacingGuides = this.detectEqualSpacing(movingShape, targetShapes);
		guides.push(...equalSpacingGuides);

		targetShapes.forEach((target) => {
			const movingRight = movingShape.x + movingShape.width;
			const movingBottom = movingShape.y + movingShape.height;
			const targetRight = target.x + target.width;
			const targetBottom = target.y + target.height;

			// Horizontal distance guides
			let horizontalGap = 0;
			if (movingRight < target.x) {
				// movingShape is to the left of target
				horizontalGap = target.x - movingRight;
			} else if (targetRight < movingShape.x) {
				// target is to the left of movingShape
				horizontalGap = movingShape.x - targetRight;
			} else {
				// shapes overlap horizontally
				horizontalGap = 0;
			}

			// Add distance guide between shapes (horizontal)
			if (horizontalGap < MAX_GUIDE_DISTANCE && horizontalGap > 0) {
				if (movingRight < target.x) {
					// Target is to the right
					guides.push({
						type: "distance",
						position: 0,
						start: { x: movingRight, y: movingShape.y + movingShape.height / 2 },
						end: { x: target.x, y: target.y + target.height / 2 },
						distance: Math.round(horizontalGap),
						style: "dotted",
					});
				} else if (targetRight < movingShape.x) {
					// Target is to the left
					guides.push({
						type: "distance",
						position: 0,
						start: { x: targetRight, y: target.y + target.height / 2 },
						end: { x: movingShape.x, y: movingShape.y + movingShape.height / 2 },
						distance: Math.round(horizontalGap),
						style: "dotted",
					});
				}
			}

			// Vertical distance guides
			let verticalGap = 0;
			if (movingBottom < target.y) {
				// movingShape is above target
				verticalGap = target.y - movingBottom;
			} else if (targetBottom < movingShape.y) {
				// target is above movingShape
				verticalGap = movingShape.y - targetBottom;
			} else {
				// shapes overlap vertically
				verticalGap = 0;
			}

			// Add distance guide between shapes (vertical)
			if (verticalGap < MAX_GUIDE_DISTANCE && verticalGap > 0) {
				if (movingBottom < target.y) {
					// Target is below
					guides.push({
						type: "distance",
						position: 0,
						start: { x: movingShape.x + movingShape.width / 2, y: movingBottom },
						end: { x: target.x + target.width / 2, y: target.y },
						distance: Math.round(verticalGap),
						style: "dotted",
					});
				} else if (targetBottom < movingShape.y) {
					// Target is above
					guides.push({
						type: "distance",
						position: 0,
						start: { x: target.x + target.width / 2, y: targetBottom },
						end: { x: movingShape.x + movingShape.width / 2, y: movingShape.y },
						distance: Math.round(verticalGap),
						style: "dotted",
					});
				}
			}

			// Extension lines for alignment
			// Vertical alignment extension
			if (Math.abs(movingShape.x - target.x) < ALIGNMENT_THRESHOLD) {
				guides.push({
					type: "vertical",
					position: target.x,
					start: { x: target.x, y: Math.min(movingShape.y, target.y) - 50 },
					end: { x: target.x, y: Math.max(movingBottom, targetBottom) + 50 },
					style: "solid",
				});
			}

			// Horizontal alignment extension
			if (Math.abs(movingShape.y - target.y) < ALIGNMENT_THRESHOLD) {
				guides.push({
					type: "horizontal",
					position: target.y,
					start: { x: Math.min(movingShape.x, target.x) - 50, y: target.y },
					end: { x: Math.max(movingRight, targetRight) + 50, y: target.y },
					style: "solid",
				});
			}
		});

		return guides;
	}

	// Detect equal spacing between shapes
	private detectEqualSpacing(
		movingShape: { x: number; y: number; width: number; height: number },
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];
		const SPACING_THRESHOLD = 5; // Tolerance for equal spacing detection

		// Find pairs of shapes with similar spacing
		if (targetShapes.length >= 2) {
			// Check horizontal spacing
			const horizontalSpacings: Array<{
				shape1: any;
				shape2: any;
				spacing: number;
				midpoint: number;
			}> = [];

			// Calculate all horizontal spacings between target shapes
			for (let i = 0; i < targetShapes.length; i++) {
				for (let j = i + 1; j < targetShapes.length; j++) {
					const shape1 = targetShapes[i];
					const shape2 = targetShapes[j];
					const shape1Right = shape1.x + shape1.width;
					const shape2Right = shape2.x + shape2.width;

					// Check if shapes are horizontally aligned (roughly same Y position)
					const yDiff = Math.abs(shape1.y - shape2.y);
					if (yDiff < 50) {
						if (shape1Right < shape2.x) {
							const spacing = shape2.x - shape1Right;
							horizontalSpacings.push({
								shape1,
								shape2,
								spacing,
								midpoint: (shape1Right + shape2.x) / 2,
							});
						} else if (shape2Right < shape1.x) {
							const spacing = shape1.x - shape2Right;
							horizontalSpacings.push({
								shape1: shape2,
								shape2: shape1,
								spacing,
								midpoint: (shape2Right + shape1.x) / 2,
							});
						}
					}
				}
			}

			// Check if moving shape creates equal spacing
			const movingRight = movingShape.x + movingShape.width;
			horizontalSpacings.forEach(({ spacing }) => {
				targetShapes.forEach((target) => {
					const targetRight = target.x + target.width;
					// Check if moving shape is aligned with this target
					const yDiff = Math.abs(movingShape.y - target.y);
					if (yDiff < 50) {
						// Check spacing between moving shape and target
						let currentSpacing = 0;
						if (movingRight < target.x) {
							currentSpacing = target.x - movingRight;
						} else if (targetRight < movingShape.x) {
							currentSpacing = movingShape.x - targetRight;
						}

						// If spacing is similar, show equal spacing indicator
						if (Math.abs(currentSpacing - spacing) < SPACING_THRESHOLD && currentSpacing > 0) {
							// Add visual indicator for equal spacing
							guides.push({
								type: "distance",
								position: 0,
								start: {
									x: movingRight < target.x ? movingRight : targetRight,
									y: movingShape.y + movingShape.height / 2,
								},
								end: {
									x: movingRight < target.x ? target.x : movingShape.x,
									y: movingShape.y + movingShape.height / 2,
								},
								distance: Math.round(spacing),
								style: "dotted",
								label: "=", // Equal spacing indicator
							});
						}
					}
				});
			});

			// Similar logic for vertical spacing
			const verticalSpacings: Array<{
				shape1: any;
				shape2: any;
				spacing: number;
				midpoint: number;
			}> = [];

			// Calculate all vertical spacings between target shapes
			for (let i = 0; i < targetShapes.length; i++) {
				for (let j = i + 1; j < targetShapes.length; j++) {
					const shape1 = targetShapes[i];
					const shape2 = targetShapes[j];
					const shape1Bottom = shape1.y + shape1.height;
					const shape2Bottom = shape2.y + shape2.height;

					// Check if shapes are vertically aligned (roughly same X position)
					const xDiff = Math.abs(shape1.x - shape2.x);
					if (xDiff < 50) {
						if (shape1Bottom < shape2.y) {
							const spacing = shape2.y - shape1Bottom;
							verticalSpacings.push({
								shape1,
								shape2,
								spacing,
								midpoint: (shape1Bottom + shape2.y) / 2,
							});
						} else if (shape2Bottom < shape1.y) {
							const spacing = shape1.y - shape2Bottom;
							verticalSpacings.push({
								shape1: shape2,
								shape2: shape1,
								spacing,
								midpoint: (shape2Bottom + shape1.y) / 2,
							});
						}
					}
				}
			}

			// Check if moving shape creates equal vertical spacing
			const movingBottom = movingShape.y + movingShape.height;
			verticalSpacings.forEach(({ spacing }) => {
				targetShapes.forEach((target) => {
					const targetBottom = target.y + target.height;
					// Check if moving shape is aligned with this target
					const xDiff = Math.abs(movingShape.x - target.x);
					if (xDiff < 50) {
						// Check spacing between moving shape and target
						let currentSpacing = 0;
						if (movingBottom < target.y) {
							currentSpacing = target.y - movingBottom;
						} else if (targetBottom < movingShape.y) {
							currentSpacing = movingShape.y - targetBottom;
						}

						// If spacing is similar, show equal spacing indicator
						if (Math.abs(currentSpacing - spacing) < SPACING_THRESHOLD && currentSpacing > 0) {
							// Add visual indicator for equal spacing
							guides.push({
								type: "distance",
								position: 0,
								start: {
									x: movingShape.x + movingShape.width / 2,
									y: movingBottom < target.y ? movingBottom : targetBottom,
								},
								end: {
									x: movingShape.x + movingShape.width / 2,
									y: movingBottom < target.y ? target.y : movingShape.y,
								},
								distance: Math.round(spacing),
								style: "dotted",
								label: "=", // Equal spacing indicator
							});
						}
					}
				});
			});
		}

		return guides;
	}

	// Calculate distribution positions for multiple shapes
	calculateDistribution(shapes: Shape[], distribution: DistributionType): Map<string, Point> {
		const updates = new Map<string, Point>();

		if (shapes.length < 3) return updates; // Need at least 3 shapes to distribute

		// Sort shapes by position
		const sortedShapes = [...shapes].sort((a, b) => {
			if (distribution === "horizontal") {
				return a.x - b.x;
			} else {
				return a.y - b.y;
			}
		});

		if (distribution === "horizontal") {
			// Get the leftmost and rightmost positions
			const firstShape = sortedShapes[0];
			const lastShape = sortedShapes[sortedShapes.length - 1];
			const firstWidth = "width" in firstShape ? firstShape.width : 0;
			const lastWidth = "width" in lastShape ? lastShape.width : 0;

			const startX = firstShape.x + firstWidth / 2;
			const endX = lastShape.x + lastWidth / 2;
			const totalDistance = endX - startX;
			const spacing = totalDistance / (sortedShapes.length - 1);

			// Distribute shapes evenly between first and last
			sortedShapes.forEach((shape, index) => {
				if (index === 0 || index === sortedShapes.length - 1) {
					// Keep first and last shapes in place
					updates.set(shape.id, { x: shape.x, y: shape.y });
				} else {
					const width = "width" in shape ? shape.width : 0;
					const centerX = startX + spacing * index;
					updates.set(shape.id, { x: centerX - width / 2, y: shape.y });
				}
			});
		} else {
			// Vertical distribution
			const firstShape = sortedShapes[0];
			const lastShape = sortedShapes[sortedShapes.length - 1];
			const firstHeight = "height" in firstShape ? firstShape.height : 0;
			const lastHeight = "height" in lastShape ? lastShape.height : 0;

			const startY = firstShape.y + firstHeight / 2;
			const endY = lastShape.y + lastHeight / 2;
			const totalDistance = endY - startY;
			const spacing = totalDistance / (sortedShapes.length - 1);

			// Distribute shapes evenly between first and last
			sortedShapes.forEach((shape, index) => {
				if (index === 0 || index === sortedShapes.length - 1) {
					// Keep first and last shapes in place
					updates.set(shape.id, { x: shape.x, y: shape.y });
				} else {
					const height = "height" in shape ? shape.height : 0;
					const centerY = startY + spacing * index;
					updates.set(shape.id, { x: shape.x, y: centerY - height / 2 });
				}
			});
		}

		return updates;
	}

	// Calculate alignment positions for multiple shapes
	calculateAlignment(shapes: Shape[], alignment: AlignmentType): Map<string, Point> {
		const updates = new Map<string, Point>();

		if (shapes.length < 2) return updates;

		switch (alignment) {
			case "left": {
				const leftMost = Math.min(...shapes.map((s) => s.x));
				shapes.forEach((shape) => {
					updates.set(shape.id, { x: leftMost, y: shape.y });
				});
				break;
			}
			case "right": {
				const rightMost = Math.max(
					...shapes.map((s) => {
						const width = "width" in s ? s.width : 0;
						return s.x + width;
					}),
				);
				shapes.forEach((shape) => {
					const width = "width" in shape ? shape.width : 0;
					updates.set(shape.id, { x: rightMost - width, y: shape.y });
				});
				break;
			}
			case "top": {
				const topMost = Math.min(...shapes.map((s) => s.y));
				shapes.forEach((shape) => {
					updates.set(shape.id, { x: shape.x, y: topMost });
				});
				break;
			}
			case "bottom": {
				const bottomMost = Math.max(
					...shapes.map((s) => {
						const height = "height" in s ? s.height : 0;
						return s.y + height;
					}),
				);
				shapes.forEach((shape) => {
					const height = "height" in shape ? shape.height : 0;
					updates.set(shape.id, { x: shape.x, y: bottomMost - height });
				});
				break;
			}
			case "center-horizontal": {
				const xs = shapes.flatMap((s) => {
					const width = "width" in s ? s.width : 0;
					return [s.x, s.x + width];
				});
				const left = Math.min(...xs);
				const right = Math.max(...xs);
				const centerX = (left + right) / 2;

				shapes.forEach((shape) => {
					const width = "width" in shape ? shape.width : 0;
					updates.set(shape.id, { x: centerX - width / 2, y: shape.y });
				});
				break;
			}
			case "center-vertical": {
				const ys = shapes.flatMap((s) => {
					const height = "height" in s ? s.height : 0;
					return [s.y, s.y + height];
				});
				const top = Math.min(...ys);
				const bottom = Math.max(...ys);
				const centerY = (top + bottom) / 2;

				shapes.forEach((shape) => {
					const height = "height" in shape ? shape.height : 0;
					updates.set(shape.id, { x: shape.x, y: centerY - height / 2 });
				});
				break;
			}
		}

		return updates;
	}

	setGridSize(size: number): void {
		this.gridSize = size;
	}

	setSnapThreshold(threshold: number): void {
		this.snapThreshold = threshold;
	}

	clearGuides(): void {
		this.activeGuides = [];
	}

	cleanup(): void {
		this.clearGuides();
	}
}
