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
	type: "horizontal" | "vertical";
	position: number;
	start: Point;
	end: Point;
}

export type AlignmentType =
	| "left"
	| "center-horizontal"
	| "right"
	| "top"
	| "center-vertical"
	| "bottom";

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
		targetShapes: Shape[],
		currentPosition: Point,
	): SnapResult {
		const snapPoints = this.findSnapPoints(movingShape, targetShapes, currentPosition);
		const snappedPosition = this.calculateSnappedPosition(currentPosition, snapPoints);

		const snapped =
			snappedPosition.x !== currentPosition.x || snappedPosition.y !== currentPosition.y;

		return {
			position: snappedPosition,
			guides: snapped ? this.generateGuides(snapPoints, snappedPosition) : [],
			snapped,
		};
	}

	private findSnapPoints(
		movingShape: { x: number; y: number; width?: number; height?: number },
		targetShapes: Shape[],
		_currentPosition: Point,
	): Array<{ axis: "x" | "y"; value: number; priority: number }> {
		const snapPoints: Array<{ axis: "x" | "y"; value: number; priority: number }> = [];
		const width = movingShape.width || 0;
		const height = movingShape.height || 0;

		targetShapes.forEach((target) => {
			if (!target) return;

			const targetWidth = "width" in target ? target.width : 0;
			const targetHeight = "height" in target ? target.height : 0;

			// Horizontal snap points (x-axis)
			// Left edge to left edge
			snapPoints.push({ axis: "x", value: target.x, priority: 1 });
			// Right edge to right edge
			snapPoints.push({ axis: "x", value: target.x + targetWidth - width, priority: 1 });
			// Left edge to right edge
			snapPoints.push({ axis: "x", value: target.x + targetWidth, priority: 2 });
			// Right edge to left edge
			snapPoints.push({ axis: "x", value: target.x - width, priority: 2 });
			// Center to center
			const targetCenterX = target.x + targetWidth / 2;
			snapPoints.push({ axis: "x", value: targetCenterX - width / 2, priority: 3 });

			// Vertical snap points (y-axis)
			// Top edge to top edge
			snapPoints.push({ axis: "y", value: target.y, priority: 1 });
			// Bottom edge to bottom edge
			snapPoints.push({ axis: "y", value: target.y + targetHeight - height, priority: 1 });
			// Top edge to bottom edge
			snapPoints.push({ axis: "y", value: target.y + targetHeight, priority: 2 });
			// Bottom edge to top edge
			snapPoints.push({ axis: "y", value: target.y - height, priority: 2 });
			// Center to center
			const targetCenterY = target.y + targetHeight / 2;
			snapPoints.push({ axis: "y", value: targetCenterY - height / 2, priority: 3 });
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

	private findClosestSnapPoint(
		value: number,
		snapPoints: Array<{ value: number; priority: number }>,
	): { value: number; priority: number } | null {
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
			});
		}

		return guides;
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
