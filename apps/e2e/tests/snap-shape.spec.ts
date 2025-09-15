import { expect, test } from "@playwright/test";

test.describe("Shape-to-Shape Snapping", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173");
		await page.waitForLoadState("networkidle");
	});

	test("should snap to shape edges when dragging close", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Create second rectangle to the right
		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second rectangle
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Drag it close to the first rectangle's right edge (should snap)
		// First rectangle's right edge is at x=200
		// Drag to x=205 (within 15px threshold) should snap to x=200
		await page.mouse.move(205, 150);
		await page.mouse.up();

		// Get the second shape position
		const shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.shapes ? Object.values(store.shapes) : [];
		});

		expect(shapes).toHaveLength(2);
		const secondShape = shapes[1] as any;

		// Should snap to the edge of the first shape (x=200)
		expect(secondShape.x).toBe(200);
	});

	test("should snap to shape centers when dragging", async ({ page }) => {
		// Create first rectangle centered at (150, 150)
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(300, 250);
		await page.mouse.down();
		await page.mouse.move(400, 350);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second rectangle
		await page.mouse.move(350, 300);
		await page.mouse.down();

		// Drag it to align centers horizontally
		// First rectangle center is at x=150, so move second shape
		// so its center aligns (second shape width is 100, so x should be 100)
		await page.mouse.move(105, 300);
		await page.mouse.up();

		// Get the shapes
		const shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.shapes ? Object.values(store.shapes) : [];
		});

		const firstShape = shapes[0] as any;
		const secondShape = shapes[1] as any;

		// Centers should be aligned horizontally
		const firstCenterX = firstShape.x + firstShape.width / 2;
		const secondCenterX = secondShape.x + secondShape.width / 2;

		expect(Math.abs(firstCenterX - secondCenterX)).toBeLessThan(5);
	});

	test("should prioritize shape snapping over grid snapping", async ({ page }) => {
		// Create first rectangle not on grid
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(105, 105);
		await page.mouse.down();
		await page.mouse.move(205, 205);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(300, 105);
		await page.mouse.down();
		await page.mouse.move(400, 205);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second rectangle
		await page.mouse.move(350, 155);
		await page.mouse.down();

		// Drag close to first shape's edge (205) which is not on grid
		// This position (210) is close to both:
		// - Shape edge at 205 (5px away)
		// - Grid line at 220 (10px away)
		// Should prefer shape snapping
		await page.mouse.move(210, 155);
		await page.mouse.up();

		// Get the shapes
		const shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.shapes ? Object.values(store.shapes) : [];
		});

		const secondShape = shapes[1] as any;

		// Should snap to shape edge (205) not grid (220)
		expect(secondShape.x).toBe(205);
	});

	test("should show snap guidelines when snapping to shapes", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select and start dragging the second rectangle
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Move close to snap point
		await page.mouse.move(205, 150);

		// Check for snap guidelines
		const guidelines = await page.locator(".snap-guidelines line").count();
		expect(guidelines).toBeGreaterThan(0);

		// Release the drag
		await page.mouse.up();

		// Guidelines should be cleared after drag
		const guidelinesAfter = await page.locator(".snap-guidelines line").count();
		expect(guidelinesAfter).toBe(0);
	});

	test("should not snap to shapes being dragged together", async ({ page }) => {
		// Create three rectangles
		await page.click('[data-testid="tool-rectangle"]');

		// First rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Second rectangle
		await page.mouse.move(250, 100);
		await page.mouse.down();
		await page.mouse.move(350, 200);
		await page.mouse.up();

		// Third rectangle (reference for snapping)
		await page.mouse.move(400, 100);
		await page.mouse.down();
		await page.mouse.move(500, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select first two rectangles with drag selection
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(380, 250);
		await page.mouse.up();

		// Verify two shapes are selected
		const selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.selectedShapeIds?.size || 0;
		});
		expect(selectedCount).toBe(2);

		// Drag the selected shapes close to the third shape
		await page.mouse.move(150, 150);
		await page.mouse.down();

		// Move close to third shape's left edge (400)
		// First shape should snap to 400 - 100 = 300
		await page.mouse.move(305, 150);
		await page.mouse.up();

		// Get the shapes
		const shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore?.getState();
			return store?.shapes ? Object.values(store.shapes) : [];
		});

		const firstShape = shapes[0] as any;
		const secondShape = shapes[1] as any;

		// First shape should snap to position where its right edge aligns with third shape's left edge
		expect(firstShape.x + firstShape.width).toBe(400);

		// Second shape should maintain relative position to first
		expect(secondShape.x - firstShape.x).toBe(150); // Original offset
	});
});
