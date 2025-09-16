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
			guides: snapped ? this.generateGuidesFromActivePoints(activeSnapPoints, movingShape, targetShapes) : [],
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
	): Array<{ axis: "x" | "y"; value: number; priority: number; targetId?: string; edgeType?: string; targetPosition?: number }> {
		const snapPoints: Array<{ axis: "x" | "y"; value: number; priority: number; targetId?: string; edgeType?: string; targetPosition?: number }> = [];
		const width = movingShape.width || 0;
		const height = movingShape.height || 0;

		targetShapes.forEach((target) => {
			if (!target) return;

			const targetWidth = target.width;
			const targetHeight = target.height;
			const targetId = target.id;

			// Horizontal snap points (x-axis)
			// Left edge to left edge
			snapPoints.push({ axis: "x", value: target.x, priority: 1, targetId, edgeType: "left-to-left", targetPosition: target.x });
			// Right edge to right edge
			snapPoints.push({ axis: "x", value: target.x + targetWidth - width, priority: 1, targetId, edgeType: "right-to-right", targetPosition: target.x + targetWidth });
			// Left edge to right edge
			snapPoints.push({ axis: "x", value: target.x + targetWidth, priority: 2, targetId, edgeType: "left-to-right", targetPosition: target.x + targetWidth });
			// Right edge to left edge
			snapPoints.push({ axis: "x", value: target.x - width, priority: 2, targetId, edgeType: "right-to-left", targetPosition: target.x });
			// Center to center
			const targetCenterX = target.x + targetWidth / 2;
			snapPoints.push({ axis: "x", value: targetCenterX - width / 2, priority: 3, targetId, edgeType: "center-to-center", targetPosition: targetCenterX });

			// Vertical snap points (y-axis)
			// Top edge to top edge
			snapPoints.push({ axis: "y", value: target.y, priority: 1, targetId, edgeType: "top-to-top", targetPosition: target.y });
			// Bottom edge to bottom edge
			snapPoints.push({ axis: "y", value: target.y + targetHeight - height, priority: 1, targetId, edgeType: "bottom-to-bottom", targetPosition: target.y + targetHeight });
			// Top edge to bottom edge
			snapPoints.push({ axis: "y", value: target.y + targetHeight, priority: 2, targetId, edgeType: "top-to-bottom", targetPosition: target.y + targetHeight });
			// Bottom edge to top edge
			snapPoints.push({ axis: "y", value: target.y - height, priority: 2, targetId, edgeType: "bottom-to-top", targetPosition: target.y });
			// Center to center
			const targetCenterY = target.y + targetHeight / 2;
			snapPoints.push({ axis: "y", value: targetCenterY - height / 2, priority: 3, targetId, edgeType: "center-to-center", targetPosition: targetCenterY });
		});

		return snapPoints;
	}

	private calculateSnappedPosition(
		currentPosition: Point,
		snapPoints: Array<{ axis: "x" | "y"; value: number; priority: number }>,
	): Point {
		const snappedPosition = { ...currentPosition };

		// Find closest snap point for each axis
		const xSnapPoints = snapPoints.filter((p) => p.axis === "x");
		const ySnapPoints = snapPoints.filter((p) => p.axis === "y");

		// Snap X axis
		if (xSnapPoints.length > 0) {
			const closest = this.findClosestSnapPoint(currentPosition.x, xSnapPoints);
			if (closest && Math.abs(currentPosition.x - closest.value) < this.snapThreshold) {
				snappedPosition.x = closest.value;
			}
		}

		// Snap Y axis
		if (ySnapPoints.length > 0) {
			const closest = this.findClosestSnapPoint(currentPosition.y, ySnapPoints);
			if (closest && Math.abs(currentPosition.y - closest.value) < this.snapThreshold) {
				snappedPosition.y = closest.value;
			}
		}

		return snappedPosition;
	}

	private calculateSnappedPositionWithActive(
		currentPosition: Point,
		snapPoints: Array<{ axis: "x" | "y"; value: number; priority: number; targetId?: string; edgeType?: string }>,
	): { position: Point; activeSnapPoints: Array<{ axis: "x" | "y"; value: number; priority: number; targetId?: string; edgeType?: string }> } {
		const snappedPosition = { ...currentPosition };
		const activeSnapPoints: Array<{ axis: "x" | "y"; value: number; priority: number; targetId?: string; edgeType?: string }> = [];

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

		// Sort by distance and priority
		const sorted = snapPoints
			.map((point) => ({
				...point,
				distance: Math.abs(value - point.value),
			}))
			.filter((point) => point.distance < this.snapThreshold)
			.sort((a, b) => {
				// First sort by priority (lower is better)
				if (a.priority !== b.priority) {
					return a.priority - b.priority;
				}
				// Then by distance
				return a.distance - b.distance;
			});

		return sorted[0] || null;
	}

	private generateGuides(
		snapPoints: Array<{ axis: "x" | "y"; value: number; priority: number }>,
		snappedPosition: Point,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		// Generate vertical guides (for x-axis snapping)
		const xSnap = snapPoints.find((p) => p.axis === "x" && p.value === snappedPosition.x);
		if (xSnap) {
			guides.push({
				type: "vertical",
				position: xSnap.value,
				start: { x: xSnap.value, y: -1000 },
				end: { x: xSnap.value, y: 1000 },
				style: "dashed",
			});
		}

		// Generate horizontal guides (for y-axis snapping)
		const ySnap = snapPoints.find((p) => p.axis === "y" && p.value === snappedPosition.y);
		if (ySnap) {
			guides.push({
				type: "horizontal",
				position: ySnap.value,
				start: { x: -1000, y: ySnap.value },
				end: { x: 1000, y: ySnap.value },
				style: "dashed",
			});
		}

		return guides;
	}

	private generateGuidesFromActivePoints(
		activeSnapPoints: Array<{ axis: "x" | "y"; value: number; priority: number; targetId?: string; edgeType?: string; targetPosition?: number }>,
		movingShape: { x: number; y: number; width?: number; height?: number },
		targetShapes: Array<{
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
