// === Snap Engine for alignment assistance ===

import type { Point, Shape } from "../types/index";
import { QuadTree } from "./quad-tree";

export interface SnapOptions {
	snapEnabled?: boolean;
	gridSnap?: boolean;
	shapeSnap?: boolean;
	gridSize?: number;
	snapThreshold?: number;
	// Performance options for snap calculation range
	snapCalculationRange?: number; // Maximum distance to search for snap candidates (default: 200)
	viewportMargin?: number; // Extra margin around viewport for shape culling (default: 200)
}

export interface SnapResult {
	position: Point;
	guides?: SnapGuide[];
	snapped: boolean;
}

export interface SnapGuide {
	type: "horizontal" | "vertical" | "distance" | "diagonal" | "threshold";
	position: number;
	start: Point;
	end: Point;
	// Smart guide specific properties
	distance?: number; // Distance value to display
	label?: string; // Optional label for the guide
	style?: "solid" | "dashed" | "dotted"; // Line style
	isEqualSpacing?: boolean; // Flag to identify equal spacing guides
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
const EQUAL_SPACING_THRESHOLD = 15; // Tolerance for equal spacing detection (increased for better UX)
const ALIGNMENT_Y_TOLERANCE = 50; // Y-axis tolerance for horizontal alignment detection
const ALIGNMENT_X_TOLERANCE = 50; // X-axis tolerance for vertical alignment detection

// Shape type for equal spacing detection
type ShapeWithBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
	[key: string]: any;
};

export class SnapEngine {
	private gridSize = 20;
	private snapThreshold = 15;
	private snapCalculationRange = 200; // Default calculation range
	private viewportMargin = 200; // Default viewport margin
	private activeGuides: SnapGuide[] = [];
	private quadTree: QuadTree | null = null;
	private viewport: { x: number; y: number; width: number; height: number } | null = null;
	private snapCandidatesCache: Map<string, ShapeWithBounds[]> = new Map();
	private lastCacheKey = "";
	private previousGuides: SnapGuide[] = [];
	private guidesUpdateFrame: number | null = null;

	constructor(gridSize = 20, snapThreshold = 15, snapCalculationRange = 200, viewportMargin = 200) {
		this.gridSize = gridSize;
		this.snapThreshold = snapThreshold;
		this.snapCalculationRange = snapCalculationRange;
		this.viewportMargin = viewportMargin;
	}

	// Update snap calculation range settings
	updateSnapRange(snapCalculationRange?: number, viewportMargin?: number): void {
		if (snapCalculationRange !== undefined) {
			this.snapCalculationRange = snapCalculationRange;
			// Clear cache when range changes
			this.snapCandidatesCache.clear();
		}
		if (viewportMargin !== undefined) {
			this.viewportMargin = viewportMargin;
		}
	}

	// Get current snap range settings
	getSnapRangeSettings(): { snapCalculationRange: number; viewportMargin: number } {
		return {
			snapCalculationRange: this.snapCalculationRange,
			viewportMargin: this.viewportMargin,
		};
	}

	// Initialize QuadTree with canvas bounds
	initializeQuadTree(bounds: { x: number; y: number; width: number; height: number }): void {
		this.quadTree = new QuadTree(bounds);
	}

	// Update viewport for culling
	setViewport(viewport: { x: number; y: number; width: number; height: number }): void {
		this.viewport = viewport;
		// Clear cache when viewport changes significantly
		const viewportKey = `${Math.floor(viewport.x / 100)},${Math.floor(viewport.y / 100)}`;
		if (viewportKey !== this.lastCacheKey) {
			this.snapCandidatesCache.clear();
			this.lastCacheKey = viewportKey;
		}
	}

	// Add shapes to spatial index
	indexShapes(shapes: ShapeWithBounds[]): void {
		if (!this.quadTree) {
			// Auto-initialize with reasonable bounds if not set
			this.initializeQuadTree({ x: -10000, y: -10000, width: 20000, height: 20000 });
		}

		// Clear and rebuild index
		this.quadTree!.clear();
		for (const shape of shapes) {
			if (shape.id && typeof shape.x === "number" && typeof shape.y === "number") {
				this.quadTree!.insert({
					id: shape.id,
					x: shape.x,
					y: shape.y,
					width: shape.width || 0,
					height: shape.height || 0,
				});
			}
		}
	}

	// Get shapes within viewport plus margin
	private getShapesInViewport(allShapes: ShapeWithBounds[], margin?: number): ShapeWithBounds[] {
		if (!this.viewport) {
			return allShapes; // No viewport culling
		}

		const actualMargin = margin ?? this.viewportMargin;
		const expandedViewport = {
			x: this.viewport.x - actualMargin,
			y: this.viewport.y - actualMargin,
			width: this.viewport.width + actualMargin * 2,
			height: this.viewport.height + actualMargin * 2,
		};

		// Use QuadTree if available
		if (this.quadTree) {
			const items = this.quadTree.query(expandedViewport);
			// Map back to original shapes
			return items
				.map((item) => allShapes.find((shape) => shape.id === item.id))
				.filter((shape): shape is ShapeWithBounds => shape !== undefined);
		}

		// Fallback to manual filtering
		return allShapes.filter((shape) => {
			return !(
				shape.x + shape.width < expandedViewport.x ||
				shape.x > expandedViewport.x + expandedViewport.width ||
				shape.y + shape.height < expandedViewport.y ||
				shape.y > expandedViewport.y + expandedViewport.height
			);
		});
	}

	// Get nearby shapes using QuadTree
	private getNearbyShapes(
		position: Point,
		allShapes: ShapeWithBounds[],
		maxDistance?: number,
	): ShapeWithBounds[] {
		// If no shapes, return empty
		if (!allShapes || allShapes.length === 0) {
			return [];
		}

		const actualMaxDistance = maxDistance ?? this.snapCalculationRange;

		// Check cache first
		const cacheKey = `${Math.round(position.x / 10)},${Math.round(position.y / 10)}`;
		if (this.snapCandidatesCache.has(cacheKey)) {
			return this.snapCandidatesCache.get(cacheKey)!;
		}

		let nearbyShapes: ShapeWithBounds[];

		if (this.quadTree) {
			// Use QuadTree for efficient spatial query
			const items = this.quadTree.findNearest(position.x, position.y, actualMaxDistance, 20);
			nearbyShapes = items
				.map((item) => allShapes.find((shape) => shape.id === item.id))
				.filter((shape): shape is ShapeWithBounds => shape !== undefined);
		} else {
			// Fallback to distance calculation
			nearbyShapes = allShapes
				.map((shape) => ({
					shape,
					distance: this.calculateDistanceToShape(position, shape),
				}))
				.filter(({ distance }) => distance <= actualMaxDistance)
				.sort((a, b) => a.distance - b.distance)
				.slice(0, 20)
				.map(({ shape }) => shape);
		}

		// Cache the result
		this.snapCandidatesCache.set(cacheKey, nearbyShapes);
		return nearbyShapes;
	}

	private calculateDistanceToShape(point: Point, shape: ShapeWithBounds): number {
		const centerX = shape.x + shape.width / 2;
		const centerY = shape.y + shape.height / 2;
		const dx = point.x - centerX;
		const dy = point.y - centerY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	// Basic grid snapping
	snap(position: Point, options?: SnapOptions): SnapResult {
		if (!options?.snapEnabled) {
			return { position, snapped: false };
		}

		const snappedPosition = { ...position };
		let snapped = false;

		if (options.gridSnap) {
			const gridSize = options.gridSize || this.gridSize;
			const snapThreshold =
				options.snapThreshold !== undefined ? options.snapThreshold : this.snapThreshold;

			const gridX = Math.round(position.x / gridSize) * gridSize;
			const gridY = Math.round(position.y / gridSize) * gridSize;

			const deltaX = Math.abs(position.x - gridX);
			const deltaY = Math.abs(position.y - gridY);

			// Only snap if within threshold
			if (deltaX < snapThreshold) {
				snappedPosition.x = gridX;
				snapped = true;
			}
			if (deltaY < snapThreshold) {
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
		options?: Pick<SnapOptions, "snapCalculationRange" | "viewportMargin">,
	): SnapResult {
		// Convert targetShapes to ShapeWithBounds if needed
		const shapesWithBounds: ShapeWithBounds[] = targetShapes.map((shape, index) => ({
			...shape,
			id: shape.id || `shape-${index}`,
		}));

		// Use optimized shape querying with optional overrides
		const nearbyShapes = this.getNearbyShapes(
			currentPosition,
			shapesWithBounds,
			options?.snapCalculationRange,
		);
		const visibleShapes = this.getShapesInViewport(nearbyShapes, options?.viewportMargin);

		const snapPoints = this.findSnapPoints(movingShape, visibleShapes, currentPosition);

		const { position: snappedPosition, activeSnapPoints } = this.calculateSnappedPositionWithActive(
			currentPosition,
			snapPoints,
		);

		const snapped =
			snappedPosition.x !== currentPosition.x || snappedPosition.y !== currentPosition.y;

		// Generate diagonal guide if diagonal snap is active
		const diagonalGuides: SnapGuide[] = [];
		if (snapped) {
			const diagonalSnapPoint = activeSnapPoints.find((p) => p.edgeType === "diagonal-45");
			if (diagonalSnapPoint?.targetId) {
				// Find the target shape to calculate the diagonal guide
				const targetShape = targetShapes.find((s) => s.id === diagonalSnapPoint.targetId);
				if (targetShape) {
					const movingCenterX = snappedPosition.x + (movingShape.width || 0) / 2;
					const movingCenterY = snappedPosition.y + (movingShape.height || 0) / 2;
					const targetCenterX = targetShape.x + targetShape.width / 2;
					const targetCenterY = targetShape.y + targetShape.height / 2;

					// Calculate angle for display
					const dx = movingCenterX - targetCenterX;
					const dy = movingCenterY - targetCenterY;
					const angleRad = Math.atan2(Math.abs(dy), Math.abs(dx));
					const angleDeg = Math.round((angleRad * 180) / Math.PI);

					diagonalGuides.push({
						type: "diagonal",
						position: 0,
						start: {
							x: targetCenterX,
							y: targetCenterY,
						},
						end: {
							x: movingCenterX,
							y: movingCenterY,
						},
						style: "dashed",
						label: `${angleDeg}°`,
					});
				}
			}
		}

		return {
			position: snappedPosition,
			guides: snapped
				? [
						...this.generateGuidesFromActivePoints(activeSnapPoints, movingShape, targetShapes),
						...diagonalGuides,
					]
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

		// First, detect equal spacing positions and add them as snap points
		const equalSpacingSnapPoints = this.findEqualSpacingSnapPoints(movingShape, targetShapes);
		if (equalSpacingSnapPoints.length > 0) {
			console.log("[SnapEngine] Equal spacing snap points found:", equalSpacingSnapPoints);
		}
		snapPoints.push(...equalSpacingSnapPoints);

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
			// Note: Left corners (TL, BL) share same X value, as do right corners (TR, BR)
			// This is intentional to enable corner-to-corner alignment
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
			// Bottom-left corner to bottom-left (same X as TL)
			snapPoints.push({
				axis: "x",
				value: target.x,
				priority: 2,
				targetId,
				edgeType: "corner-bl-to-bl",
				targetPosition: target.x,
			});
			// Bottom-right corner to bottom-right (same X as TR)
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
			// Note: Top corners (TL, TR) share same Y value, as do bottom corners (BL, BR)
			// This is intentional to enable corner-to-corner alignment
			// Top-left corner to top-left
			snapPoints.push({
				axis: "y",
				value: target.y,
				priority: 2,
				targetId,
				edgeType: "corner-tl-to-tl",
				targetPosition: target.y,
			});
			// Top-right corner to top-right (same Y as TL)
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
			// Bottom-right corner to bottom-right (same Y as BL)
			snapPoints.push({
				axis: "y",
				value: target.y + targetHeight - height,
				priority: 2,
				targetId,
				edgeType: "corner-br-to-br",
				targetPosition: target.y + targetHeight,
			});
		});

		// Add diagonal (45°) snap points with lower priority
		// They will only be used if no better snap points are within range
		const diagonalSnapPoints = this.findDiagonalSnapPoints(movingShape, targetShapes);
		snapPoints.push(...diagonalSnapPoints);

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

		// Check if we have diagonal snap points active
		const hasDiagonalSnap = activeSnapPoints.some((p) => p.edgeType === "diagonal-45");

		activeSnapPoints.forEach((snapPoint) => {
			// Skip generating alignment guides for equal spacing snap points
			// Equal spacing guides are generated separately in generateSmartGuides
			if (snapPoint.edgeType?.startsWith("equal-spacing")) {
				return;
			}

			// Skip vertical/horizontal guides when diagonal snap is active
			// We want to show only the diagonal guide in this case
			if (hasDiagonalSnap && snapPoint.edgeType !== "diagonal-45") {
				return;
			}

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
						start: { x: -2000, y: snapPoint.targetPosition },
						end: { x: 2000, y: snapPoint.targetPosition },
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
						start: { x: -2000, y: snapPoint.value },
						end: { x: 2000, y: snapPoint.value },
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
		selectedShapes?: Array<{ x: number; y: number; width: number; height: number }>,
		mousePosition?: Point,
		showDistances?: boolean,
		showEqualSpacing?: boolean,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		// If multiple shapes are selected, calculate group bounds
		let effectiveShape = movingShape;
		if (selectedShapes && selectedShapes.length > 1) {
			effectiveShape = this.calculateGroupBounds(selectedShapes);
		}

		// Check for equal spacing between shapes (if enabled)
		if (showEqualSpacing !== false) {
			const equalSpacingGuides = this.detectEqualSpacing(effectiveShape, targetShapes);
			guides.push(...equalSpacingGuides);
		}

		// Add mouse pointer distance guides if mouse position is provided and distances are enabled
		if (mousePosition && showDistances !== false) {
			const mouseDistanceGuides = this.generateMouseDistanceGuides(mousePosition, targetShapes);
			guides.push(...mouseDistanceGuides);
		}

		// Add snap threshold visualization if requested
		if (showDistances && mousePosition) {
			const thresholdGuides = this.generateSnapThresholdIndicators(effectiveShape, targetShapes);
			guides.push(...thresholdGuides);
		}

		targetShapes.forEach((target) => {
			const movingRight = effectiveShape.x + effectiveShape.width;
			const movingBottom = effectiveShape.y + effectiveShape.height;
			const targetRight = target.x + target.width;
			const targetBottom = target.y + target.height;

			// Horizontal distance guides
			let horizontalGap = 0;
			if (movingRight < target.x) {
				// effectiveShape is to the left of target
				horizontalGap = target.x - movingRight;
			} else if (targetRight < effectiveShape.x) {
				// target is to the left of effectiveShape
				horizontalGap = effectiveShape.x - targetRight;
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
						start: { x: movingRight, y: effectiveShape.y + effectiveShape.height / 2 },
						end: { x: target.x, y: target.y + target.height / 2 },
						distance: Math.round(horizontalGap),
						style: "dotted",
					});
				} else if (targetRight < effectiveShape.x) {
					// Target is to the left
					guides.push({
						type: "distance",
						position: 0,
						start: { x: targetRight, y: target.y + target.height / 2 },
						end: { x: effectiveShape.x, y: effectiveShape.y + effectiveShape.height / 2 },
						distance: Math.round(horizontalGap),
						style: "dotted",
					});
				}
			}

			// Vertical distance guides
			let verticalGap = 0;
			if (movingBottom < target.y) {
				// effectiveShape is above target
				verticalGap = target.y - movingBottom;
			} else if (targetBottom < effectiveShape.y) {
				// target is above effectiveShape
				verticalGap = effectiveShape.y - targetBottom;
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
						start: { x: effectiveShape.x + effectiveShape.width / 2, y: movingBottom },
						end: { x: target.x + target.width / 2, y: target.y },
						distance: Math.round(verticalGap),
						style: "dotted",
					});
				} else if (targetBottom < effectiveShape.y) {
					// Target is above
					guides.push({
						type: "distance",
						position: 0,
						start: { x: target.x + target.width / 2, y: targetBottom },
						end: { x: effectiveShape.x + effectiveShape.width / 2, y: effectiveShape.y },
						distance: Math.round(verticalGap),
						style: "dotted",
					});
				}
			}

			// Extension lines for alignment
			// Vertical alignment extension (left edges)
			if (Math.abs(effectiveShape.x - target.x) < ALIGNMENT_THRESHOLD) {
				const minY = Math.min(effectiveShape.y, target.y);
				const maxY = Math.max(movingBottom, targetBottom);
				guides.push({
					type: "vertical",
					position: target.x,
					start: { x: target.x, y: minY - 100 },
					end: { x: target.x, y: maxY + 100 },
					style: "solid",
				});
			}

			// Vertical alignment extension (right edges)
			if (Math.abs(movingRight - targetRight) < ALIGNMENT_THRESHOLD) {
				const minY = Math.min(effectiveShape.y, target.y);
				const maxY = Math.max(movingBottom, targetBottom);
				guides.push({
					type: "vertical",
					position: targetRight,
					start: { x: targetRight, y: minY - 100 },
					end: { x: targetRight, y: maxY + 100 },
					style: "solid",
				});
			}

			// Vertical alignment extension (center)
			const movingCenterX = effectiveShape.x + effectiveShape.width / 2;
			const targetCenterX = target.x + target.width / 2;
			if (Math.abs(movingCenterX - targetCenterX) < ALIGNMENT_THRESHOLD) {
				const minY = Math.min(effectiveShape.y, target.y);
				const maxY = Math.max(movingBottom, targetBottom);
				guides.push({
					type: "vertical",
					position: targetCenterX,
					start: { x: targetCenterX, y: minY - 100 },
					end: { x: targetCenterX, y: maxY + 100 },
					style: "solid",
				});
			}

			// Horizontal alignment extension (top edges)
			if (Math.abs(effectiveShape.y - target.y) < ALIGNMENT_THRESHOLD) {
				const minX = Math.min(effectiveShape.x, target.x);
				const maxX = Math.max(movingRight, targetRight);
				guides.push({
					type: "horizontal",
					position: target.y,
					start: { x: minX - 100, y: target.y },
					end: { x: maxX + 100, y: target.y },
					style: "solid",
				});
			}

			// Horizontal alignment extension (bottom edges)
			if (Math.abs(movingBottom - targetBottom) < ALIGNMENT_THRESHOLD) {
				const minX = Math.min(effectiveShape.x, target.x);
				const maxX = Math.max(movingRight, targetRight);
				guides.push({
					type: "horizontal",
					position: targetBottom,
					start: { x: minX - 100, y: targetBottom },
					end: { x: maxX + 100, y: targetBottom },
					style: "solid",
				});
			}

			// Horizontal alignment extension (center)
			const movingCenterY = effectiveShape.y + effectiveShape.height / 2;
			const targetCenterY = target.y + target.height / 2;
			if (Math.abs(movingCenterY - targetCenterY) < ALIGNMENT_THRESHOLD) {
				const minX = Math.min(effectiveShape.x, target.x);
				const maxX = Math.max(movingRight, targetRight);
				guides.push({
					type: "horizontal",
					position: targetCenterY,
					start: { x: minX - 100, y: targetCenterY },
					end: { x: maxX + 100, y: targetCenterY },
					style: "solid",
				});
			}

			// Diagonal alignment detection (45° and 135°)
			// Use the actual first selected shape for diagonal guides, not the group bounds
			const shapeForDiagonal =
				selectedShapes && selectedShapes.length > 0 ? selectedShapes[0] : movingShape;
			const diagonalGuides = this.detectDiagonalAlignment(shapeForDiagonal, target);
			guides.push(...diagonalGuides);
		});

		// Use differential update with RAF
		return this.updateGuidesWithRAF(guides);
	}

	// Generate snap threshold visualization indicators
	private generateSnapThresholdIndicators(
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

		// Find shapes within snap threshold
		targetShapes.forEach((target) => {
			// Check edges
			const edges = [
				{ axis: "x" as const, value: target.x, label: "left" },
				{ axis: "x" as const, value: target.x + target.width, label: "right" },
				{ axis: "y" as const, value: target.y, label: "top" },
				{ axis: "y" as const, value: target.y + target.height, label: "bottom" },
			];

			edges.forEach((edge) => {
				if (edge.axis === "x") {
					// Check if moving shape's edges are within threshold
					const movingEdges = [movingShape.x, movingShape.x + movingShape.width];
					movingEdges.forEach((movingEdge) => {
						const distance = Math.abs(movingEdge - edge.value);
						if (distance > 0 && distance <= this.snapThreshold) {
							// Add threshold indicator (vertical line with threshold radius)
							guides.push({
								type: "threshold",
								position: edge.value,
								start: { x: edge.value - this.snapThreshold, y: target.y },
								end: { x: edge.value + this.snapThreshold, y: target.y + target.height },
								distance: this.snapThreshold,
								style: "dotted",
								label: `±${this.snapThreshold}px`,
							});
						}
					});
				} else {
					// Check if moving shape's edges are within threshold
					const movingEdges = [movingShape.y, movingShape.y + movingShape.height];
					movingEdges.forEach((movingEdge) => {
						const distance = Math.abs(movingEdge - edge.value);
						if (distance > 0 && distance <= this.snapThreshold) {
							// Add threshold indicator (horizontal line with threshold radius)
							guides.push({
								type: "threshold",
								position: edge.value,
								start: { x: target.x, y: edge.value - this.snapThreshold },
								end: { x: target.x + target.width, y: edge.value + this.snapThreshold },
								distance: this.snapThreshold,
								style: "dotted",
								label: `±${this.snapThreshold}px`,
							});
						}
					});
				}
			});
		});

		return guides;
	}

	// Generate distance guides from mouse pointer to nearby shapes
	private generateMouseDistanceGuides(
		mousePosition: Point,
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];
		const MAX_MOUSE_DISTANCE = 150; // Maximum distance to show mouse guides

		targetShapes.forEach((shape) => {
			// Find the closest point on the shape to the mouse
			const closestX = Math.max(shape.x, Math.min(mousePosition.x, shape.x + shape.width));
			const closestY = Math.max(shape.y, Math.min(mousePosition.y, shape.y + shape.height));

			// Calculate distance from mouse to closest point
			const dx = mousePosition.x - closestX;
			const dy = mousePosition.y - closestY;
			const distance = Math.sqrt(dx * dx + dy * dy);

			// Only show guides for nearby shapes
			if (distance > 0 && distance < MAX_MOUSE_DISTANCE) {
				// Determine if it's primarily horizontal or vertical
				if (Math.abs(dx) > Math.abs(dy)) {
					// Horizontal distance is dominant
					guides.push({
						type: "distance",
						position: 0,
						start: mousePosition,
						end: { x: closestX, y: mousePosition.y },
						distance: Math.round(Math.abs(dx)),
						style: "dotted",
						label: `${Math.round(Math.abs(dx))}px`,
					});
				} else {
					// Vertical distance is dominant
					guides.push({
						type: "distance",
						position: 0,
						start: mousePosition,
						end: { x: mousePosition.x, y: closestY },
						distance: Math.round(Math.abs(dy)),
						style: "dotted",
						label: `${Math.round(Math.abs(dy))}px`,
					});
				}
			}
		});

		return guides;
	}

	// Calculate bounding box for a group of shapes
	private calculateGroupBounds(
		shapes: Array<{ x: number; y: number; width: number; height: number }>,
	): { x: number; y: number; width: number; height: number } {
		if (shapes.length === 0) {
			return { x: 0, y: 0, width: 0, height: 0 };
		}

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		for (const shape of shapes) {
			minX = Math.min(minX, shape.x);
			minY = Math.min(minY, shape.y);
			maxX = Math.max(maxX, shape.x + shape.width);
			maxY = Math.max(maxY, shape.y + shape.height);
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}

	// Detect diagonal alignment between shapes (45° and 135°)
	private detectDiagonalAlignment(
		movingShape: { x: number; y: number; width: number; height: number },
		target: { x: number; y: number; width: number; height: number },
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		// Get center points
		const movingCenterX = movingShape.x + movingShape.width / 2;
		const movingCenterY = movingShape.y + movingShape.height / 2;
		const targetCenterX = target.x + target.width / 2;
		const targetCenterY = target.y + target.height / 2;

		// Calculate differences
		const dx = movingCenterX - targetCenterX;
		const dy = movingCenterY - targetCenterY;

		// Check if the shapes form a diagonal alignment
		// For perfect 45° diagonal, |dx| should equal |dy|
		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);
		const distance = Math.sqrt(dx * dx + dy * dy);

		// Skip if too far apart
		if (distance >= MAX_GUIDE_DISTANCE * 2) {
			return guides;
		}

		// Calculate the ratio to determine if it's close to 45° or 135°
		const ratio = absDx > 0 ? absDy / absDx : 0;
		const DIAGONAL_TOLERANCE = 0.15; // Allow 15% deviation from perfect diagonal

		// Check if it's close to a 45° diagonal (ratio should be close to 1)
		if (Math.abs(ratio - 1.0) < DIAGONAL_TOLERANCE) {
			// Calculate actual angle in degrees for display
			const angleRad = Math.atan2(Math.abs(dy), Math.abs(dx));
			const angleDeg = Math.round((angleRad * 180) / Math.PI);

			guides.push({
				type: "diagonal",
				position: 0,
				start: {
					x: targetCenterX,
					y: targetCenterY,
				},
				end: {
					x: movingCenterX,
					y: movingCenterY,
				},
				style: "dashed",
				label: `${angleDeg}°`, // Show actual angle
			});
		}

		return guides;
	}

	// Find snap points for equal spacing positions

	// Find snap points for 45° diagonal alignment
	private findDiagonalSnapPoints(
		movingShape: { x: number; y: number; width?: number; height?: number },
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
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
		const movingCenterX = movingShape.x + width / 2;
		const movingCenterY = movingShape.y + height / 2;

		targetShapes.forEach((target) => {
			const targetCenterX = target.x + target.width / 2;
			const targetCenterY = target.y + target.height / 2;

			// Calculate the position that would place the moving shape at 45° from the target
			// There are 8 possible 45° positions (NE, E, SE, S, SW, W, NW, N directions)

			// For each direction, calculate where the moving shape should be to maintain 45° alignment
			// We'll use the center-to-center distance and project it along the 45° lines

			const dx = movingCenterX - targetCenterX;
			const dy = movingCenterY - targetCenterY;
			const currentDistance = Math.sqrt(dx * dx + dy * dy);

			// Skip if shapes are too far apart
			if (currentDistance > MAX_GUIDE_DISTANCE * 2) {
				return;
			}

			// Check if already close to 45° alignment (within tolerance)
			const absDx = Math.abs(dx);
			const absDy = Math.abs(dy);
			const ratio = absDx > 0 ? absDy / absDx : 0;
			const DIAGONAL_TOLERANCE = 0.2; // Allow 20% deviation from perfect diagonal

			// Only add diagonal snap points if we're already close to a diagonal
			if (Math.abs(ratio - 1.0) > DIAGONAL_TOLERANCE) {
				return; // Not close enough to diagonal, skip
			}

			// Also check if we're close enough to actually snap
			const avgDistance = (absDx + absDy) / 2;
			const distanceFromPerfect45 = Math.max(
				Math.abs(absDx - avgDistance),
				Math.abs(absDy - avgDistance),
			);

			// Only create snap points if we're VERY close to perfect 45°
			// This ensures we don't interfere with other snap types
			if (distanceFromPerfect45 > this.snapThreshold * 0.5) {
				// Not close enough to perfect 45° position
				return;
			}

			// For 45° alignment, |dx| should equal |dy|
			// We'll create snap points that would make this true

			// Northeast (45°): dx = dy (both positive from target)
			if (dx > 0 && dy < 0) {
				// Snap to make dx = -dy
				const avgDistance = (Math.abs(dx) + Math.abs(dy)) / 2;
				snapPoints.push({
					axis: "x",
					value: targetCenterX + avgDistance - width / 2,
					priority: 5, // Very low priority - only used when no other snaps are available
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterX,
				});
				snapPoints.push({
					axis: "y",
					value: targetCenterY - avgDistance - height / 2,
					priority: 5, // Very low priority - only used when no other snaps are available
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterY,
				});
			}

			// Southeast (315°/-45°): dx = -dy
			else if (dx > 0 && dy > 0) {
				const avgDistance = (Math.abs(dx) + Math.abs(dy)) / 2;
				snapPoints.push({
					axis: "x",
					value: targetCenterX + avgDistance - width / 2,
					priority: 4, // Lower priority than edge/center snaps
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterX,
				});
				snapPoints.push({
					axis: "y",
					value: targetCenterY + avgDistance - height / 2,
					priority: 4, // Lower priority than edge/center snaps
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterY,
				});
			}

			// Southwest (225°): dx = dy (both negative from target)
			else if (dx < 0 && dy > 0) {
				const avgDistance = (Math.abs(dx) + Math.abs(dy)) / 2;
				snapPoints.push({
					axis: "x",
					value: targetCenterX - avgDistance - width / 2,
					priority: 4, // Lower priority than edge/center snaps
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterX,
				});
				snapPoints.push({
					axis: "y",
					value: targetCenterY + avgDistance - height / 2,
					priority: 4, // Lower priority than edge/center snaps
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterY,
				});
			}

			// Northwest (135°): dx = -dy
			else if (dx < 0 && dy < 0) {
				const avgDistance = (Math.abs(dx) + Math.abs(dy)) / 2;
				snapPoints.push({
					axis: "x",
					value: targetCenterX - avgDistance - width / 2,
					priority: 4, // Lower priority than edge/center snaps
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterX,
				});
				snapPoints.push({
					axis: "y",
					value: targetCenterY - avgDistance - height / 2,
					priority: 4, // Lower priority than edge/center snaps
					targetId: target.id,
					edgeType: "diagonal-45",
					targetPosition: targetCenterY,
				});
			}
		});

		return snapPoints;
	}

	// Find snap points for equal spacing
	private findEqualSpacingSnapPoints(
		movingShape: { x: number; y: number; width?: number; height?: number },
		targetShapes: Array<{
			x: number;
			y: number;
			width: number;
			height: number;
			[key: string]: any;
		}>,
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
		}> = [];

		const width = movingShape.width || 0;
		const height = movingShape.height || 0;
		const ALIGNMENT_X_TOLERANCE = 50;
		const ALIGNMENT_Y_TOLERANCE = 50;
		const EQUAL_SPACING_THRESHOLD = 15; // Use the same tolerance as global constant

		// Convert to ShapeWithBounds for consistency
		const shapesWithBounds: ShapeWithBounds[] = targetShapes.map((shape, index) => ({
			...shape,
			id: shape.id || `shape-${index}`,
		}));

		// Group shapes by horizontal alignment (similar Y position)
		const horizontalGroups = new Map<number, ShapeWithBounds[]>();
		shapesWithBounds.forEach((shape) => {
			let foundGroup = false;
			for (const [y, group] of horizontalGroups.entries()) {
				if (Math.abs(shape.y - y) < ALIGNMENT_Y_TOLERANCE) {
					group.push(shape);
					foundGroup = true;
					break;
				}
			}
			if (!foundGroup) {
				horizontalGroups.set(shape.y, [shape]);
			}
		});

		// For each horizontal group, find equal spacing positions
		horizontalGroups.forEach((group) => {
			if (group.length < 2) return;

			// Sort shapes by X position
			const sortedShapes = [...group].sort((a, b) => a.x - b.x);

			// Calculate spacings between consecutive shapes
			const spacings: number[] = [];
			for (let i = 0; i < sortedShapes.length - 1; i++) {
				const shape1Right = sortedShapes[i].x + sortedShapes[i].width;
				const shape2Left = sortedShapes[i + 1].x;
				const spacing = shape2Left - shape1Right;
				if (spacing > 0) {
					spacings.push(spacing);
				}
			}

			// Find the most common spacing (if there are at least 2 equal spacings)
			const spacingCounts = new Map<number, number>();
			spacings.forEach((spacing) => {
				for (const [existingSpacing, count] of spacingCounts.entries()) {
					if (Math.abs(spacing - existingSpacing) < EQUAL_SPACING_THRESHOLD) {
						spacingCounts.set(existingSpacing, count + 1);
						return;
					}
				}
				spacingCounts.set(spacing, 1);
			});

			// Find spacing patterns with at least 2 occurrences
			const commonSpacings = Array.from(spacingCounts.entries())
				.filter(([, count]) => count >= 2)
				.map(([spacing]) => spacing);

			if (commonSpacings.length === 0) return;

			const targetSpacing = commonSpacings[0]; // Use the first common spacing
			const groupY = sortedShapes[0].y;

			// Check if moving shape is aligned with this group
			if (Math.abs(movingShape.y - groupY) < ALIGNMENT_Y_TOLERANCE) {
				// Add snap points before and after each shape in the group
				sortedShapes.forEach((shape, _index) => {
					// Snap point to the left of the shape
					const leftSnapX = shape.x - targetSpacing - width;
					snapPoints.push({
						axis: "x",
						value: leftSnapX,
						priority: 1, // High priority for equal spacing
						edgeType: "equal-spacing-left",
					});

					// Snap point to the right of the shape
					const rightSnapX = shape.x + shape.width + targetSpacing;
					snapPoints.push({
						axis: "x",
						value: rightSnapX,
						priority: 1, // High priority for equal spacing
						edgeType: "equal-spacing-right",
					});
				});
			}
		});

		// Group shapes by vertical alignment (similar X position)
		const verticalGroups = new Map<number, ShapeWithBounds[]>();
		shapesWithBounds.forEach((shape) => {
			let foundGroup = false;
			for (const [x, group] of verticalGroups.entries()) {
				if (Math.abs(shape.x - x) < ALIGNMENT_X_TOLERANCE) {
					group.push(shape);
					foundGroup = true;
					break;
				}
			}
			if (!foundGroup) {
				verticalGroups.set(shape.x, [shape]);
			}
		});

		// For each vertical group, find equal spacing positions
		verticalGroups.forEach((group) => {
			if (group.length < 2) return;

			// Sort shapes by Y position
			const sortedShapes = [...group].sort((a, b) => a.y - b.y);

			// Calculate spacings between consecutive shapes
			const spacings: number[] = [];
			for (let i = 0; i < sortedShapes.length - 1; i++) {
				const shape1Bottom = sortedShapes[i].y + sortedShapes[i].height;
				const shape2Top = sortedShapes[i + 1].y;
				const spacing = shape2Top - shape1Bottom;
				if (spacing > 0) {
					spacings.push(spacing);
				}
			}

			// Find the most common spacing
			const spacingCounts = new Map<number, number>();
			spacings.forEach((spacing) => {
				for (const [existingSpacing, count] of spacingCounts.entries()) {
					if (Math.abs(spacing - existingSpacing) < EQUAL_SPACING_THRESHOLD) {
						spacingCounts.set(existingSpacing, count + 1);
						return;
					}
				}
				spacingCounts.set(spacing, 1);
			});

			// Find spacing patterns with at least 2 occurrences
			const commonSpacings = Array.from(spacingCounts.entries())
				.filter(([, count]) => count >= 2)
				.map(([spacing]) => spacing);

			if (commonSpacings.length === 0) return;

			const targetSpacing = commonSpacings[0];
			const groupX = sortedShapes[0].x;

			// Check if moving shape is aligned with this group
			if (Math.abs(movingShape.x - groupX) < ALIGNMENT_X_TOLERANCE) {
				// Add snap points above and below each shape in the group
				sortedShapes.forEach((shape) => {
					// Snap point above the shape
					const topSnapY = shape.y - targetSpacing - height;
					snapPoints.push({
						axis: "y",
						value: topSnapY,
						priority: 1, // High priority for equal spacing
						edgeType: "equal-spacing-top",
					});

					// Snap point below the shape
					const bottomSnapY = shape.y + shape.height + targetSpacing;
					snapPoints.push({
						axis: "y",
						value: bottomSnapY,
						priority: 1, // High priority for equal spacing
						edgeType: "equal-spacing-bottom",
					});
				});
			}
		});

		return snapPoints;
	}

	// Detect equal spacing between shapes
	private detectEqualSpacing(
		movingShape: { x: number; y: number; width: number; height: number },
		targetShapes: Array<ShapeWithBounds>,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		if (targetShapes.length < 2) {
			return guides;
		}

		// Check horizontal equal spacing (shapes aligned in a row)
		// Group shapes that are horizontally aligned
		const horizontalGroups: Map<number, ShapeWithBounds[]> = new Map();

		targetShapes.forEach((shape) => {
			// Find if there's an existing group at a similar Y position
			let foundGroup = false;
			for (const [y, group] of horizontalGroups.entries()) {
				if (Math.abs(shape.y - y) < ALIGNMENT_Y_TOLERANCE) {
					group.push(shape);
					foundGroup = true;
					break;
				}
			}
			if (!foundGroup) {
				horizontalGroups.set(shape.y, [shape]);
			}
		});

		// For each horizontal group with at least 2 shapes, check for equal spacing
		horizontalGroups.forEach((group, _groupY) => {
			if (group.length < 2) {
				return;
			}

			// Sort shapes by X position
			const sortedShapes = [...group].sort((a, b) => a.x - b.x);

			// Find equal spacings in this group
			const spacings: number[] = [];
			for (let i = 0; i < sortedShapes.length - 1; i++) {
				const shape1Right = sortedShapes[i].x + sortedShapes[i].width;
				const shape2Left = sortedShapes[i + 1].x;
				const spacing = shape2Left - shape1Right;
				spacings.push(spacing);
			}

			// Check if there are at least 2 equal spacings
			let _foundEqualSpacing = false;
			for (let i = 0; i < spacings.length - 1; i++) {
				for (let j = i + 1; j < spacings.length; j++) {
					if (Math.abs(spacings[i] - spacings[j]) < EQUAL_SPACING_THRESHOLD) {
						// Found equal spacing pattern
						const equalSpacing = (spacings[i] + spacings[j]) / 2;
						_foundEqualSpacing = true;

						// Now check if moving shape aligns with this group and creates equal spacing
						const movingY = movingShape.y;
						const groupY = sortedShapes[0].y;

						if (Math.abs(movingY - groupY) < ALIGNMENT_Y_TOLERANCE) {
							// Moving shape is aligned with this group
							// Include moving shape in the group for complete equal spacing detection
							const allShapes = [...sortedShapes];

							// Find where to insert the moving shape in the sorted array
							let insertIndex = 0;
							for (let k = 0; k < sortedShapes.length; k++) {
								if (movingShape.x < sortedShapes[k].x) {
									break;
								}
								insertIndex = k + 1;
							}
							allShapes.splice(insertIndex, 0, movingShape);

							// Recalculate all spacings with moving shape included
							const allSpacings: Array<{ spacing: number; fromIndex: number; toIndex: number }> =
								[];
							for (let k = 0; k < allShapes.length - 1; k++) {
								const shape1Right = allShapes[k].x + allShapes[k].width;
								const shape2Left = allShapes[k + 1].x;
								const spacing = shape2Left - shape1Right;
								allSpacings.push({ spacing, fromIndex: k, toIndex: k + 1 });
							}

							// Show guides for all pairs that match the equal spacing
							for (const spacingInfo of allSpacings) {
								if (Math.abs(spacingInfo.spacing - equalSpacing) < EQUAL_SPACING_THRESHOLD) {
									const shape1 = allShapes[spacingInfo.fromIndex];
									const shape2 = allShapes[spacingInfo.toIndex];
									const shape1Right = shape1.x + shape1.width;
									const shape2Left = shape2.x;

									// Use a consistent Y position for equal spacing guides
									// based on the average Y position of the group
									const guideY = groupY + sortedShapes[0].height / 2;
									guides.push({
										type: "distance",
										position: 0,
										start: {
											x: shape1Right,
											y: guideY,
										},
										end: {
											x: shape2Left,
											y: guideY,
										},
										distance: Math.round(equalSpacing),
										style: "dotted",
										label: `${Math.round(equalSpacing)}px`,
										isEqualSpacing: true,
									});
								}
							}
						}
					}
				}
			}
		});

		// Similar logic for vertical equal spacing
		const verticalGroups: Map<number, ShapeWithBounds[]> = new Map();

		targetShapes.forEach((shape) => {
			// Find if there's an existing group at a similar X position
			let foundGroup = false;
			for (const [x, group] of verticalGroups.entries()) {
				if (Math.abs(shape.x - x) < ALIGNMENT_X_TOLERANCE) {
					group.push(shape);
					foundGroup = true;
					break;
				}
			}
			if (!foundGroup) {
				verticalGroups.set(shape.x, [shape]);
			}
		});

		// For each vertical group with at least 2 shapes, check for equal spacing
		verticalGroups.forEach((group) => {
			if (group.length < 2) return;

			// Sort shapes by Y position
			const sortedShapes = [...group].sort((a, b) => a.y - b.y);

			// Find equal spacings in this group
			const spacings: number[] = [];
			for (let i = 0; i < sortedShapes.length - 1; i++) {
				const shape1Bottom = sortedShapes[i].y + sortedShapes[i].height;
				const shape2Top = sortedShapes[i + 1].y;
				const spacing = shape2Top - shape1Bottom;
				spacings.push(spacing);
			}

			// Check if there are at least 2 equal spacings
			for (let i = 0; i < spacings.length - 1; i++) {
				for (let j = i + 1; j < spacings.length; j++) {
					if (Math.abs(spacings[i] - spacings[j]) < EQUAL_SPACING_THRESHOLD) {
						// Found equal spacing pattern
						const equalSpacing = (spacings[i] + spacings[j]) / 2;

						// Now check if moving shape aligns with this group and creates equal spacing
						const movingX = movingShape.x;
						const groupX = sortedShapes[0].x;

						if (Math.abs(movingX - groupX) < ALIGNMENT_X_TOLERANCE) {
							// Moving shape is aligned with this group
							// Include moving shape in the group for complete equal spacing detection
							const allShapes = [...sortedShapes];

							// Find where to insert the moving shape in the sorted array
							let insertIndex = 0;
							for (let k = 0; k < sortedShapes.length; k++) {
								if (movingShape.y < sortedShapes[k].y) {
									break;
								}
								insertIndex = k + 1;
							}
							allShapes.splice(insertIndex, 0, movingShape);

							// Recalculate all spacings with moving shape included
							const allSpacings: Array<{ spacing: number; fromIndex: number; toIndex: number }> =
								[];
							for (let k = 0; k < allShapes.length - 1; k++) {
								const shape1Bottom = allShapes[k].y + allShapes[k].height;
								const shape2Top = allShapes[k + 1].y;
								const spacing = shape2Top - shape1Bottom;
								allSpacings.push({ spacing, fromIndex: k, toIndex: k + 1 });
							}

							// Show guides for all pairs that match the equal spacing
							for (const spacingInfo of allSpacings) {
								if (Math.abs(spacingInfo.spacing - equalSpacing) < EQUAL_SPACING_THRESHOLD) {
									const shape1 = allShapes[spacingInfo.fromIndex];
									const shape2 = allShapes[spacingInfo.toIndex];
									const shape1Bottom = shape1.y + shape1.height;
									const shape2Top = shape2.y;

									// Use a consistent X position for equal spacing guides
									// based on the average X position of the group
									const guideX = groupX + sortedShapes[0].width / 2;
									guides.push({
										type: "distance",
										position: 0,
										start: {
											x: guideX,
											y: shape1Bottom,
										},
										end: {
											x: guideX,
											y: shape2Top,
										},
										distance: Math.round(equalSpacing),
										style: "dotted",
										label: `${Math.round(equalSpacing)}px`,
										isEqualSpacing: true,
									});
								}
							}
						}
					}
				}
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
		this.previousGuides = [];
		if (this.guidesUpdateFrame !== null) {
			cancelAnimationFrame(this.guidesUpdateFrame);
			this.guidesUpdateFrame = null;
		}
	}

	cleanup(): void {
		this.clearGuides();
		this.snapCandidatesCache.clear();
		if (this.quadTree) {
			this.quadTree.clear();
		}
	}

	// Differential guide update with requestAnimationFrame
	private updateGuidesWithRAF(newGuides: SnapGuide[]): SnapGuide[] {
		// Check if guides have actually changed
		if (this.areGuidesEqual(newGuides, this.previousGuides)) {
			return this.previousGuides; // Return cached guides
		}

		// Cancel any pending update
		if (this.guidesUpdateFrame !== null) {
			cancelAnimationFrame(this.guidesUpdateFrame);
		}

		// Schedule update in next animation frame
		this.guidesUpdateFrame = requestAnimationFrame(() => {
			this.previousGuides = newGuides;
			this.guidesUpdateFrame = null;
		});

		return newGuides;
	}

	// Check if two guide arrays are equal
	private areGuidesEqual(guides1: SnapGuide[], guides2: SnapGuide[]): boolean {
		if (guides1.length !== guides2.length) return false;

		for (let i = 0; i < guides1.length; i++) {
			const g1 = guides1[i];
			const g2 = guides2[i];

			if (
				g1.type !== g2.type ||
				g1.position !== g2.position ||
				g1.start.x !== g2.start.x ||
				g1.start.y !== g2.start.y ||
				g1.end.x !== g2.end.x ||
				g1.end.y !== g2.end.y ||
				g1.style !== g2.style ||
				g1.distance !== g2.distance ||
				g1.label !== g2.label
			) {
				return false;
			}
		}

		return true;
	}

	// Get performance statistics
	getPerformanceStats(): {
		cacheSize: number;
		quadTreeStats: any;
		viewportEnabled: boolean;
	} {
		return {
			cacheSize: this.snapCandidatesCache.size,
			quadTreeStats: this.quadTree?.getStats() || null,
			viewportEnabled: this.viewport !== null,
		};
	}
}
