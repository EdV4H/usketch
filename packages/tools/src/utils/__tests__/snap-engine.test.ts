import { beforeEach, describe, expect, it } from "vitest";
import type { Point } from "../../types/index";
import { SnapEngine } from "../snap-engine";

describe("SnapEngine", () => {
	let snapEngine: SnapEngine;

	beforeEach(() => {
		// Using default parameters with custom calculation range for testing
		snapEngine = new SnapEngine(10, 10, 200, 200); // gridSize=10, snapThreshold=10, snapCalcRange=200, viewportMargin=200
	});

	describe("Grid Snapping", () => {
		it("should snap to grid when within threshold", () => {
			const position: Point = { x: 23, y: 27 };
			const result = snapEngine.snap(position, {
				snapEnabled: true,
				gridSnap: true,
				gridSize: 10,
				snapThreshold: 10,
			});

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(20); // Snaps to nearest grid point
			expect(result.position.y).toBe(30);
		});

		it("should not snap to grid when outside threshold", () => {
			const position: Point = { x: 15, y: 15 }; // Exactly 5 units from both 10 and 20
			const result = snapEngine.snap(position, {
				snapEnabled: true,
				gridSnap: true,
				gridSize: 10,
				snapThreshold: 4, // Threshold less than 5
			});

			expect(result.snapped).toBe(false);
			expect(result.position.x).toBe(15);
			expect(result.position.y).toBe(15);
		});

		it("should not snap when snap is disabled", () => {
			const position: Point = { x: 23, y: 27 };
			const result = snapEngine.snap(position, {
				snapEnabled: false,
				gridSnap: true,
				gridSize: 10,
				snapThreshold: 5,
			});

			expect(result.snapped).toBe(false);
			expect(result.position.x).toBe(23);
			expect(result.position.y).toBe(27);
		});

		it("should handle exact grid positions", () => {
			const position: Point = { x: 30, y: 40 };
			const result = snapEngine.snap(position, {
				snapEnabled: true,
				gridSnap: true,
				gridSize: 10,
				snapThreshold: 10,
			});

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(30);
			expect(result.position.y).toBe(40);
		});
	});

	describe("Shape-to-Shape Snapping", () => {
		const targetShapes = [
			{ id: "shape1", x: 100, y: 100, width: 100, height: 100 },
			{ id: "shape2", x: 250, y: 100, width: 100, height: 100 },
			{ id: "shape3", x: 100, y: 250, width: 100, height: 100 },
		];

		it("should snap to shape left edge", () => {
			const movingShape = { x: 95, y: 150, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 95, y: 150 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(100); // Snaps to left edge of shape1
			expect(result.position.y).toBe(150);
		});

		it("should snap to shape right edge", () => {
			const movingShape = { x: 205, y: 150, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 205, y: 150 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(200); // Snaps to right edge of shape1
			expect(result.position.y).toBe(150);
		});

		it("should snap to shape top edge", () => {
			const movingShape = { x: 150, y: 95, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 150, y: 95 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(150);
			expect(result.position.y).toBe(100); // Snaps to top edge of shape1
		});

		it("should snap to shape bottom edge", () => {
			const movingShape = { x: 150, y: 205, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 150, y: 205 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(150);
			expect(result.position.y).toBe(200); // Snaps to bottom edge of shape1
		});

		it("should snap to center alignment", () => {
			// Moving shape is close to center alignment
			// Target shape1 is at 100,100 with size 100x100, so its center is at 150,150
			// For center-to-center snap, the snap point is calculated differently
			const movingShape = { x: 120, y: 120, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 120, y: 120 });

			// Should snap to align centers (both at 150, 150)
			// Moving shape needs to be at x=125, y=125 for its center to be at 150,150
			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(125); // Center at 150
			expect(result.position.y).toBe(125); // Center at 150
		});

		it("should snap to closest shape when multiple are nearby", () => {
			const movingShape = { x: 195, y: 150, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 195, y: 150 });

			// Should snap to right edge of shape1 (closer than left edge of shape2)
			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(200); // Right edge of shape1
		});

		it("should not snap when outside threshold", () => {
			const movingShape = { x: 90, y: 150, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 90, y: 150 });

			expect(result.snapped).toBe(false);
			expect(result.position.x).toBe(90);
			expect(result.position.y).toBe(150);
		});

		it("should handle empty target shapes", () => {
			const movingShape = { x: 150, y: 150, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, [], { x: 150, y: 150 });

			expect(result.snapped).toBe(false);
			expect(result.position.x).toBe(150);
			expect(result.position.y).toBe(150);
		});

		it("should snap both axes independently", () => {
			const movingShape = { x: 95, y: 95, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 95, y: 95 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(100); // Snaps to left edge
			expect(result.position.y).toBe(100); // Snaps to top edge
		});

		it("should generate snap guides when snapping occurs", () => {
			const movingShape = { x: 95, y: 150, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 95, y: 150 });

			expect(result.guides).toBeDefined();
			expect(result.guides!.length).toBeGreaterThan(0);

			const verticalGuide = result.guides!.find((g) => g.type === "vertical");
			expect(verticalGuide).toBeDefined();
			expect(verticalGuide!.position).toBe(100); // Guide at left edge
		});
	});

	describe("Smart Guides", () => {
		const targetShapes = [
			{ id: "shape1", x: 100, y: 100, width: 100, height: 100 },
			{ id: "shape2", x: 300, y: 100, width: 100, height: 100 },
		];

		it("should generate distance guides between shapes", () => {
			const movingShape = { x: 220, y: 100, width: 50, height: 100 };
			const guides = snapEngine.generateSmartGuides(
				movingShape,
				targetShapes,
				undefined,
				undefined,
				true, // showDistances
			);

			const distanceGuide = guides.find((g) => g.type === "distance");
			expect(distanceGuide).toBeDefined();
			expect(distanceGuide!.distance).toBe(20); // Gap between shapes
		});

		it("should generate alignment guides", () => {
			const movingShape = { x: 150, y: 100, width: 100, height: 100 };
			const guides = snapEngine.generateSmartGuides(movingShape, targetShapes);

			const horizontalGuide = guides.find((g) => g.type === "horizontal");
			expect(horizontalGuide).toBeDefined();
			expect(horizontalGuide!.position).toBe(100); // Top alignment
		});

		it("should generate guides for multiple selected shapes", () => {
			const movingShape = { x: 150, y: 250, width: 100, height: 100 };
			const selectedShapes = [movingShape, { x: 300, y: 250, width: 100, height: 100 }];

			const guides = snapEngine.generateSmartGuides(movingShape, targetShapes, selectedShapes);

			expect(guides).toBeDefined();
			expect(guides.length).toBeGreaterThan(0);
		});
	});

	describe("Alignment and Distribution", () => {
		const shapes = [
			{ id: "shape1", x: 100, y: 100, width: 50, height: 50 },
			{ id: "shape2", x: 200, y: 150, width: 50, height: 50 },
			{ id: "shape3", x: 300, y: 200, width: 50, height: 50 },
		];

		it("should calculate left alignment", () => {
			const updates = snapEngine.calculateAlignment(shapes, "left");

			expect(updates.get("shape1")).toEqual({ x: 100, y: 100 });
			expect(updates.get("shape2")).toEqual({ x: 100, y: 150 });
			expect(updates.get("shape3")).toEqual({ x: 100, y: 200 });
		});

		it("should calculate right alignment", () => {
			const updates = snapEngine.calculateAlignment(shapes, "right");

			expect(updates.get("shape1")).toEqual({ x: 300, y: 100 });
			expect(updates.get("shape2")).toEqual({ x: 300, y: 150 });
			expect(updates.get("shape3")).toEqual({ x: 300, y: 200 });
		});

		it("should calculate horizontal distribution", () => {
			const updates = snapEngine.calculateDistribution(shapes, "horizontal");

			// First and last should stay in place
			expect(updates.get("shape1")).toEqual({ x: 100, y: 100 });
			expect(updates.get("shape3")).toEqual({ x: 300, y: 200 });

			// Middle should be centered
			expect(updates.get("shape2")!.x).toBeCloseTo(200, 1);
		});

		it("should calculate vertical distribution", () => {
			const updates = snapEngine.calculateDistribution(shapes, "vertical");

			// First and last should stay in place
			expect(updates.get("shape1")).toEqual({ x: 100, y: 100 });
			expect(updates.get("shape3")).toEqual({ x: 300, y: 200 });

			// Middle should be centered
			expect(updates.get("shape2")!.y).toBeCloseTo(150, 1);
		});
	});

	describe("Performance Optimizations", () => {
		it("should initialize QuadTree", () => {
			snapEngine.initializeQuadTree({ x: 0, y: 0, width: 1000, height: 1000 });
			const stats = snapEngine.getPerformanceStats();

			expect(stats.quadTreeStats).toBeDefined();
			expect(stats.quadTreeStats.totalItems).toBe(0);
		});

		it("should index shapes in QuadTree", () => {
			const shapes = [
				{ id: "shape1", x: 100, y: 100, width: 100, height: 100 },
				{ id: "shape2", x: 300, y: 300, width: 100, height: 100 },
			];

			snapEngine.indexShapes(shapes);
			const stats = snapEngine.getPerformanceStats();

			expect(stats.quadTreeStats).toBeDefined();
			expect(stats.quadTreeStats.totalItems).toBe(2);
		});

		it("should set viewport for culling", () => {
			snapEngine.setViewport({ x: 0, y: 0, width: 800, height: 600 });
			const stats = snapEngine.getPerformanceStats();

			expect(stats.viewportEnabled).toBe(true);
		});

		it("should cache snap candidates", () => {
			const targetShapes = [{ id: "shape1", x: 100, y: 100, width: 100, height: 100 }];

			// First call should calculate
			snapEngine.snapToShapes({ x: 95, y: 150, width: 50, height: 50 }, targetShapes, {
				x: 95,
				y: 150,
			});

			const stats1 = snapEngine.getPerformanceStats();
			const cacheSize1 = stats1.cacheSize;

			// Second call with similar position should use cache
			snapEngine.snapToShapes({ x: 96, y: 151, width: 50, height: 50 }, targetShapes, {
				x: 96,
				y: 151,
			});

			const stats2 = snapEngine.getPerformanceStats();
			expect(stats2.cacheSize).toBeGreaterThanOrEqual(cacheSize1);
		});

		it("should cleanup resources", () => {
			snapEngine.indexShapes([{ id: "shape1", x: 100, y: 100, width: 100, height: 100 }]);

			snapEngine.cleanup();
			const stats = snapEngine.getPerformanceStats();

			expect(stats.cacheSize).toBe(0);
			if (stats.quadTreeStats) {
				expect(stats.quadTreeStats.totalItems).toBe(0);
			}
		});
	});

	describe("Snap Calculation Range Settings", () => {
		it("should update snap calculation range", () => {
			snapEngine.updateSnapRange(500, 300);
			const settings = snapEngine.getSnapRangeSettings();

			expect(settings.snapCalculationRange).toBe(500);
			expect(settings.viewportMargin).toBe(300);
		});

		it("should update only snapCalculationRange when viewportMargin not provided", () => {
			snapEngine.updateSnapRange(600);
			const settings = snapEngine.getSnapRangeSettings();

			expect(settings.snapCalculationRange).toBe(600);
			expect(settings.viewportMargin).toBe(200); // Should remain unchanged
		});

		it("should update only viewportMargin when snapCalculationRange not provided", () => {
			snapEngine.updateSnapRange(undefined, 400);
			const settings = snapEngine.getSnapRangeSettings();

			expect(settings.snapCalculationRange).toBe(200); // Should remain unchanged
			expect(settings.viewportMargin).toBe(400);
		});

		it("should use custom snapCalculationRange in snapToShapes", () => {
			const targetShapes = [
				{ id: "far-shape", x: 400, y: 400, width: 100, height: 100 }, // Far shape (400 units away)
			];

			const movingShape = { x: 0, y: 0, width: 50, height: 50 };

			// With default range (200), should not snap to far shape
			let result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 0, y: 0 });
			expect(result.snapped).toBe(false);

			// With custom range (500), should snap to far shape
			result = snapEngine.snapToShapes(
				movingShape,
				targetShapes,
				{ x: 0, y: 0 },
				{
					snapCalculationRange: 500,
				},
			);
			expect(result.snapped).toBe(false); // Still too far for actual snapping

			// But the shape should be considered as a candidate
			// Move closer within snap threshold
			result = snapEngine.snapToShapes(
				movingShape,
				targetShapes,
				{ x: 395, y: 395 },
				{
					snapCalculationRange: 500,
				},
			);
			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(400); // Snapped to shape edge
			expect(result.position.y).toBe(400);
		});

		it("should clear cache when snapCalculationRange changes", () => {
			const targetShapes = [{ id: "shape1", x: 100, y: 100, width: 100, height: 100 }];

			// First call should cache
			snapEngine.snapToShapes({ x: 95, y: 95, width: 50, height: 50 }, targetShapes, {
				x: 95,
				y: 95,
			});

			const stats1 = snapEngine.getPerformanceStats();
			const cacheSize1 = stats1.cacheSize;
			expect(cacheSize1).toBeGreaterThan(0);

			// Update range should clear cache
			snapEngine.updateSnapRange(300);

			const stats2 = snapEngine.getPerformanceStats();
			expect(stats2.cacheSize).toBe(0);
		});
	});

	describe("Edge Cases", () => {
		it("should handle shapes with zero dimensions", () => {
			const targetShapes = [{ id: "shape1", x: 100, y: 100, width: 0, height: 0 }];

			const movingShape = { x: 95, y: 95, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: 95, y: 95 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(100);
			expect(result.position.y).toBe(100);
		});

		it("should handle negative coordinates", () => {
			const targetShapes = [{ id: "shape1", x: -100, y: -100, width: 100, height: 100 }];

			const movingShape = { x: -5, y: -5, width: 50, height: 50 };
			const result = snapEngine.snapToShapes(movingShape, targetShapes, { x: -5, y: -5 });

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(0); // Snaps to right edge
			expect(result.position.y).toBe(0); // Snaps to bottom edge
		});

		it("should handle very large coordinates", () => {
			const position: Point = { x: 999997, y: 999998 };
			const result = snapEngine.snap(position, {
				snapEnabled: true,
				gridSnap: true,
				gridSize: 10,
				snapThreshold: 10,
			});

			expect(result.snapped).toBe(true);
			expect(result.position.x).toBe(1000000);
			expect(result.position.y).toBe(1000000);
		});
	});
});
