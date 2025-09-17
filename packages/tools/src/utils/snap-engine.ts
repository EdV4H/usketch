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
const EQUAL_SPACING_THRESHOLD = 5; // Tolerance for equal spacing detection
const ALIGNMENT_Y_TOLERANCE = 50; // Y-axis tolerance for horizontal alignment detection
const ALIGNMENT_X_TOLERANCE = 50; // X-axis tolerance for vertical alignment detection
const DIAGONAL_ALIGNMENT_THRESHOLD = 10; // Threshold for diagonal alignment detection
const DIAGONAL_ANGLE_45 = Math.PI / 4; // 45 degrees in radians
const DIAGONAL_ANGLE_135 = (3 * Math.PI) / 4; // 135 degrees in radians

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
			// Vertical alignment extension
			if (Math.abs(effectiveShape.x - target.x) < ALIGNMENT_THRESHOLD) {
				guides.push({
					type: "vertical",
					position: target.x,
					start: { x: target.x, y: Math.min(effectiveShape.y, target.y) - 50 },
					end: { x: target.x, y: Math.max(movingBottom, targetBottom) + 50 },
					style: "solid",
				});
			}

			// Horizontal alignment extension
			if (Math.abs(effectiveShape.y - target.y) < ALIGNMENT_THRESHOLD) {
				guides.push({
					type: "horizontal",
					position: target.y,
					start: { x: Math.min(effectiveShape.x, target.x) - 50, y: target.y },
					end: { x: Math.max(movingRight, targetRight) + 50, y: target.y },
					style: "solid",
				});
			}

			// Diagonal alignment detection (45° and 135°)
			const diagonalGuides = this.detectDiagonalAlignment(effectiveShape, target);
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

		// Calculate angle between centers
		const dx = movingCenterX - targetCenterX;
		const dy = movingCenterY - targetCenterY;
		const angle = Math.atan2(dy, dx);

		// Normalize angle to 0-2π range
		const normalizedAngle = angle < 0 ? angle + 2 * Math.PI : angle;

		// Check for 45° alignment (π/4, 5π/4)
		const angle45_1 = DIAGONAL_ANGLE_45;
		const angle45_2 = angle45_1 + Math.PI; // 225°

		// Check for 135° alignment (3π/4, 7π/4)
		const angle135_1 = DIAGONAL_ANGLE_135;
		const angle135_2 = angle135_1 + Math.PI; // 315°

		// Helper function to check if angles are close
		const isAngleClose = (a1: number, a2: number, threshold: number = 0.1) => {
			// Handle angle wrapping
			const diff = Math.abs(a1 - a2);
			return diff < threshold || Math.abs(diff - 2 * Math.PI) < threshold;
		};

		// Check 45° diagonal
		if (isAngleClose(normalizedAngle, angle45_1) || isAngleClose(normalizedAngle, angle45_2)) {
			// Calculate the extended line points for 45° diagonal
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < MAX_GUIDE_DISTANCE * 2) {
				const extendLength = 100;
				const unitX = Math.cos(angle45_1);
				const unitY = Math.sin(angle45_1);

				guides.push({
					type: "diagonal",
					position: 0,
					start: {
						x: targetCenterX - unitX * extendLength,
						y: targetCenterY - unitY * extendLength,
					},
					end: {
						x: movingCenterX + unitX * extendLength,
						y: movingCenterY + unitY * extendLength,
					},
					style: "dashed",
					label: "45°",
				});
			}
		}

		// Check 135° diagonal
		if (isAngleClose(normalizedAngle, angle135_1) || isAngleClose(normalizedAngle, angle135_2)) {
			// Calculate the extended line points for 135° diagonal
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance < MAX_GUIDE_DISTANCE * 2) {
				const extendLength = 100;
				const unitX = Math.cos(angle135_1);
				const unitY = Math.sin(angle135_1);

				guides.push({
					type: "diagonal",
					position: 0,
					start: {
						x: targetCenterX - unitX * extendLength,
						y: targetCenterY - unitY * extendLength,
					},
					end: {
						x: movingCenterX + unitX * extendLength,
						y: movingCenterY + unitY * extendLength,
					},
					style: "dashed",
					label: "135°",
				});
			}
		}

		return guides;
	}

	// Detect equal spacing between shapes
	private detectEqualSpacing(
		movingShape: { x: number; y: number; width: number; height: number },
		targetShapes: Array<ShapeWithBounds>,
	): SnapGuide[] {
		const guides: SnapGuide[] = [];

		// Find pairs of shapes with similar spacing
		if (targetShapes.length >= 2) {
			// Check horizontal spacing
			const horizontalSpacings: Array<{
				shape1: ShapeWithBounds;
				shape2: ShapeWithBounds;
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
					if (yDiff < ALIGNMENT_Y_TOLERANCE) {
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
					if (yDiff < ALIGNMENT_Y_TOLERANCE) {
						// Check spacing between moving shape and target
						let currentSpacing = 0;
						if (movingRight < target.x) {
							currentSpacing = target.x - movingRight;
						} else if (targetRight < movingShape.x) {
							currentSpacing = movingShape.x - targetRight;
						}

						// If spacing is similar, show equal spacing indicator
						if (
							Math.abs(currentSpacing - spacing) < EQUAL_SPACING_THRESHOLD &&
							currentSpacing > 0
						) {
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
				shape1: ShapeWithBounds;
				shape2: ShapeWithBounds;
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
					if (xDiff < ALIGNMENT_X_TOLERANCE) {
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
					if (xDiff < ALIGNMENT_X_TOLERANCE) {
						// Check spacing between moving shape and target
						let currentSpacing = 0;
						if (movingBottom < target.y) {
							currentSpacing = target.y - movingBottom;
						} else if (targetBottom < movingShape.y) {
							currentSpacing = movingShape.y - targetBottom;
						}

						// If spacing is similar, show equal spacing indicator
						if (
							Math.abs(currentSpacing - spacing) < EQUAL_SPACING_THRESHOLD &&
							currentSpacing > 0
						) {
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
