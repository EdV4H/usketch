import { beforeEach, describe, expect, it } from "vitest";
import { QuadTree } from "../quad-tree";

describe("QuadTree", () => {
	let quadTree: QuadTree;

	beforeEach(() => {
		quadTree = new QuadTree({ x: 0, y: 0, width: 1000, height: 1000 });
	});

	describe("Basic Operations", () => {
		it("should insert items", () => {
			const item = { id: "item1", x: 100, y: 100, width: 50, height: 50 };
			const result = quadTree.insert(item);

			expect(result).toBe(true);
			const stats = quadTree.getStats();
			expect(stats.totalItems).toBe(1);
		});

		it("should not insert duplicate items", () => {
			const item = { id: "item1", x: 100, y: 100, width: 50, height: 50 };

			quadTree.insert(item);
			const result = quadTree.insert(item);

			expect(result).toBe(false);
			const stats = quadTree.getStats();
			expect(stats.totalItems).toBe(1);
		});

		it("should remove items", () => {
			const item = { id: "item1", x: 100, y: 100, width: 50, height: 50 };

			quadTree.insert(item);
			const result = quadTree.remove("item1");

			expect(result).toBe(true);
			const stats = quadTree.getStats();
			expect(stats.totalItems).toBe(0);
		});

		it("should return false when removing non-existent item", () => {
			const result = quadTree.remove("non-existent");
			expect(result).toBe(false);
		});

		it("should update item position", () => {
			const item = { id: "item1", x: 100, y: 100, width: 50, height: 50 };

			quadTree.insert(item);
			const result = quadTree.update("item1", { x: 200, y: 200 });

			expect(result).toBe(true);

			// Query new position
			const items = quadTree.query({ x: 150, y: 150, width: 100, height: 100 });
			expect(items.length).toBe(1);
			expect(items[0].x).toBe(200);
			expect(items[0].y).toBe(200);
		});

		it("should clear all items", () => {
			quadTree.insert({ id: "item1", x: 100, y: 100, width: 50, height: 50 });
			quadTree.insert({ id: "item2", x: 200, y: 200, width: 50, height: 50 });

			quadTree.clear();

			const stats = quadTree.getStats();
			expect(stats.totalItems).toBe(0);
		});
	});

	describe("Spatial Queries", () => {
		beforeEach(() => {
			// Insert items in different quadrants
			quadTree.insert({ id: "item1", x: 100, y: 100, width: 50, height: 50 });
			quadTree.insert({ id: "item2", x: 600, y: 100, width: 50, height: 50 });
			quadTree.insert({ id: "item3", x: 100, y: 600, width: 50, height: 50 });
			quadTree.insert({ id: "item4", x: 600, y: 600, width: 50, height: 50 });
			quadTree.insert({ id: "item5", x: 350, y: 350, width: 100, height: 100 });
		});

		it("should query items in a region", () => {
			const items = quadTree.query({ x: 50, y: 50, width: 200, height: 200 });

			expect(items.length).toBe(1);
			expect(items[0].id).toBe("item1");
		});

		it("should query items that intersect boundaries", () => {
			const items = quadTree.query({ x: 300, y: 300, width: 200, height: 200 });

			expect(items.length).toBe(1);
			expect(items[0].id).toBe("item5");
		});

		it("should query all items with large bounds", () => {
			const items = quadTree.query({ x: 0, y: 0, width: 1000, height: 1000 });

			expect(items.length).toBe(5);
		});

		it("should return empty array for region with no items", () => {
			const items = quadTree.query({ x: 800, y: 800, width: 100, height: 100 });

			expect(items.length).toBe(0);
		});

		it("should handle overlapping items correctly", () => {
			quadTree.insert({ id: "overlap1", x: 90, y: 90, width: 70, height: 70 });

			const items = quadTree.query({ x: 50, y: 50, width: 150, height: 150 });

			expect(items.length).toBe(2); // item1 and overlap1
		});
	});

	describe("Nearest Neighbor Queries", () => {
		beforeEach(() => {
			quadTree.insert({ id: "item1", x: 100, y: 100, width: 50, height: 50 });
			quadTree.insert({ id: "item2", x: 200, y: 200, width: 50, height: 50 });
			quadTree.insert({ id: "item3", x: 400, y: 400, width: 50, height: 50 });
		});

		it("should find nearest items to a point", () => {
			const items = quadTree.findNearest(150, 150, 100, 2);

			expect(items.length).toBe(2);
			expect(items[0].id).toBe("item1"); // Closest
			expect(items[1].id).toBe("item2"); // Second closest
		});

		it("should respect max distance", () => {
			const items = quadTree.findNearest(0, 0, 50);

			expect(items.length).toBe(0); // No items within 50 units
		});

		it("should respect max items limit", () => {
			const items = quadTree.findNearest(250, 250, 500, 2);

			expect(items.length).toBe(2); // Limited to 2 items
		});

		it("should find items touching the search point", () => {
			const items = quadTree.findNearest(150, 125, 50);

			expect(items.length).toBe(1);
			expect(items[0].id).toBe("item1"); // Edge of item1 is at x=150
		});
	});

	describe("Subdivision Behavior", () => {
		it("should subdivide when exceeding max items", () => {
			// Insert more than MAX_ITEMS_PER_NODE (4) in same area
			for (let i = 0; i < 5; i++) {
				quadTree.insert({
					id: `item${i}`,
					x: 100 + i * 10,
					y: 100 + i * 10,
					width: 20,
					height: 20,
				});
			}

			const stats = quadTree.getStats();
			expect(stats.maxDepth).toBeGreaterThan(0); // Should have subdivided
			expect(stats.nodeCount).toBeGreaterThan(1); // Should have child nodes
		});

		it("should respect max depth limit", () => {
			// Insert many items in a very small area to force max depth
			for (let i = 0; i < 20; i++) {
				quadTree.insert({
					id: `item${i}`,
					x: 100 + i * 0.1,
					y: 100 + i * 0.1,
					width: 1,
					height: 1,
				});
			}

			const stats = quadTree.getStats();
			expect(stats.maxDepth).toBeLessThanOrEqual(8); // MAX_DEPTH = 8
		});

		it("should not subdivide below minimum node size", () => {
			// Create a small quadtree
			const smallTree = new QuadTree({ x: 0, y: 0, width: 40, height: 40 });

			// Insert many items
			for (let i = 0; i < 10; i++) {
				smallTree.insert({
					id: `item${i}`,
					x: 10 + i,
					y: 10 + i,
					width: 5,
					height: 5,
				});
			}

			const stats = smallTree.getStats();
			// Should not subdivide much due to MIN_NODE_SIZE = 50
			expect(stats.maxDepth).toBe(0);
		});
	});

	describe("Edge Cases", () => {
		it("should handle items outside bounds", () => {
			const item = { id: "outside", x: 1500, y: 1500, width: 50, height: 50 };
			const result = quadTree.insert(item);

			expect(result).toBe(false); // Should not insert
		});

		it("should handle items partially outside bounds", () => {
			const item = { id: "partial", x: 950, y: 950, width: 100, height: 100 };
			const result = quadTree.insert(item);

			// QuadTree allows items that partially intersect the bounds
			expect(result).toBe(true); // Can insert if partially within bounds
		});

		it("should handle zero-sized items", () => {
			const item = { id: "point", x: 500, y: 500, width: 0, height: 0 };
			const result = quadTree.insert(item);

			expect(result).toBe(true);

			const items = quadTree.query({ x: 490, y: 490, width: 20, height: 20 });
			expect(items.length).toBe(1);
		});

		it("should handle negative coordinates within bounds", () => {
			const tree = new QuadTree({ x: -500, y: -500, width: 1000, height: 1000 });
			const item = { id: "negative", x: -100, y: -100, width: 50, height: 50 };

			const result = tree.insert(item);
			expect(result).toBe(true);

			const items = tree.query({ x: -200, y: -200, width: 200, height: 200 });
			expect(items.length).toBe(1);
		});

		it("should handle very small items", () => {
			const item = { id: "tiny", x: 500, y: 500, width: 0.1, height: 0.1 };
			const result = quadTree.insert(item);

			expect(result).toBe(true);
		});
	});

	describe("Performance", () => {
		it("should handle large number of items efficiently", () => {
			const startTime = performance.now();

			// Insert 1000 items
			for (let i = 0; i < 1000; i++) {
				quadTree.insert({
					id: `item${i}`,
					x: Math.random() * 900,
					y: Math.random() * 900,
					width: 50,
					height: 50,
				});
			}

			const insertTime = performance.now() - startTime;
			expect(insertTime).toBeLessThan(100); // Should be fast

			// Query performance
			const queryStart = performance.now();
			const items = quadTree.query({ x: 400, y: 400, width: 200, height: 200 });
			const queryTime = performance.now() - queryStart;

			expect(queryTime).toBeLessThan(10); // Queries should be very fast
			expect(items.length).toBeGreaterThan(0);

			const stats = quadTree.getStats();
			expect(stats.totalItems).toBe(1000);
		});

		it("should provide useful statistics", () => {
			// Insert items to create interesting tree structure
			for (let i = 0; i < 4; i++) {
				for (let j = 0; j < 4; j++) {
					quadTree.insert({
						id: `item${i}-${j}`,
						x: i * 250,
						y: j * 250,
						width: 50,
						height: 50,
					});
				}
			}

			const stats = quadTree.getStats();
			expect(stats).toHaveProperty("totalItems");
			expect(stats).toHaveProperty("maxDepth");
			expect(stats).toHaveProperty("nodeCount");
			expect(stats.totalItems).toBe(16);
			expect(stats.maxDepth).toBeGreaterThanOrEqual(1);
			expect(stats.nodeCount).toBeGreaterThanOrEqual(5); // Root + 4 children minimum
		});

		it("should provide tree structure for debugging", () => {
			quadTree.insert({ id: "item1", x: 100, y: 100, width: 50, height: 50 });
			quadTree.insert({ id: "item2", x: 600, y: 600, width: 50, height: 50 });

			const structure = quadTree.getTreeStructure();

			expect(structure).toHaveProperty("bounds");
			expect(structure).toHaveProperty("itemCount");
			expect(structure).toHaveProperty("divided");
			expect(structure).toHaveProperty("children");
		});
	});

	describe("Item Updates", () => {
		it("should maintain item after position update", () => {
			const item = { id: "moving", x: 100, y: 100, width: 50, height: 50 };
			quadTree.insert(item);

			// Move item multiple times
			quadTree.update("moving", { x: 200, y: 200 });
			quadTree.update("moving", { x: 300, y: 300 });
			quadTree.update("moving", { x: 400, y: 400 });

			const items = quadTree.query({ x: 350, y: 350, width: 100, height: 100 });
			expect(items.length).toBe(1);
			expect(items[0].id).toBe("moving");
			expect(items[0].x).toBe(400);
			expect(items[0].y).toBe(400);
		});

		it("should handle size updates", () => {
			const item = { id: "resizing", x: 100, y: 100, width: 50, height: 50 };
			quadTree.insert(item);

			quadTree.update("resizing", { width: 100, height: 100 });

			const items = quadTree.query({ x: 180, y: 180, width: 50, height: 50 });
			expect(items.length).toBe(1); // Should now intersect
			expect(items[0].width).toBe(100);
			expect(items[0].height).toBe(100);
		});

		it("should return false for updating non-existent item", () => {
			const result = quadTree.update("non-existent", { x: 100 });
			expect(result).toBe(false);
		});
	});
});
