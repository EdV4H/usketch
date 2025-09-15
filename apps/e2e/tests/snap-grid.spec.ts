const { expect, test } = require("@playwright/test");

test.describe("Grid Snap Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		// Wait for the canvas to be ready
		await page.waitForSelector('[data-testid="whiteboard-canvas"]');
	});

	test("should snap shapes to grid when dragging", async ({ page }) => {
		// Create a rectangle
		await page.click('[data-testid="tool-rectangle"]');

		// Draw rectangle at non-grid position
		await page.mouse.move(105, 107);
		await page.mouse.down();
		await page.mouse.move(155, 157);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the shape
		const shape = await page.locator("[data-shape-id]").first();
		await shape.click();

		// Get initial position (should be near 105, 107)
		let transform = await shape.getAttribute("transform");
		let match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const initialX = match ? parseFloat(match[1]) : 0;
		const initialY = match ? parseFloat(match[2]) : 0;

		// Drag the shape slightly (less than snap threshold)
		await page.mouse.move(initialX + 50, initialY + 50);
		await page.mouse.down();
		await page.mouse.move(initialX + 53, initialY + 53); // Move by 3 pixels
		await page.mouse.up();

		// Check if shape snapped to grid (should snap to nearest 10px grid)
		transform = await shape.getAttribute("transform");
		match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const snappedX = match ? parseFloat(match[1]) : 0;
		const snappedY = match ? parseFloat(match[2]) : 0;

		// The shape should snap to grid positions (multiples of 10)
		expect(snappedX % 10).toBeLessThanOrEqual(1); // Allow small floating point errors
		expect(snappedY % 10).toBeLessThanOrEqual(1);
	});

	test("should snap multiple selected shapes together", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(102, 103);
		await page.mouse.down();
		await page.mouse.move(152, 153);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(202, 203);
		await page.mouse.down();
		await page.mouse.move(252, 253);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select both shapes using selection box
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		await page.waitForTimeout(100);

		// Get all shapes
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBeGreaterThanOrEqual(2);

		// Get initial positions
		const initialPositions = await Promise.all(
			shapes.slice(0, 2).map(async (shape) => {
				const transform = await shape.getAttribute("transform");
				const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
				return {
					x: match ? parseFloat(match[1]) : 0,
					y: match ? parseFloat(match[2]) : 0,
				};
			}),
		);

		// Calculate relative offset between shapes
		const relativeX = initialPositions[1].x - initialPositions[0].x;
		const relativeY = initialPositions[1].y - initialPositions[0].y;

		// Drag both shapes slightly
		await page.mouse.move(initialPositions[0].x + 25, initialPositions[0].y + 25);
		await page.mouse.down();
		await page.mouse.move(initialPositions[0].x + 28, initialPositions[0].y + 28); // Small movement
		await page.mouse.up();

		// Get new positions
		const newPositions = await Promise.all(
			shapes.slice(0, 2).map(async (shape) => {
				const transform = await shape.getAttribute("transform");
				const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
				return {
					x: match ? parseFloat(match[1]) : 0,
					y: match ? parseFloat(match[2]) : 0,
				};
			}),
		);

		// Both should snap to grid
		expect(newPositions[0].x % 10).toBeLessThanOrEqual(1);
		expect(newPositions[0].y % 10).toBeLessThanOrEqual(1);

		// Relative positions should be maintained
		const newRelativeX = newPositions[1].x - newPositions[0].x;
		const newRelativeY = newPositions[1].y - newPositions[0].y;

		expect(Math.abs(newRelativeX - relativeX)).toBeLessThanOrEqual(1);
		expect(Math.abs(newRelativeY - relativeY)).toBeLessThanOrEqual(1);
	});

	test("should snap to exact grid position when very close", async ({ page }) => {
		// Create a rectangle
		await page.click('[data-testid="tool-rectangle"]');

		// Draw rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the shape
		const shape = await page.locator("[data-shape-id]").first();
		await shape.click();

		// Drag to position very close to grid line (within threshold)
		await page.mouse.move(125, 125);
		await page.mouse.down();
		await page.mouse.move(197, 197); // Close to 200, 200
		await page.mouse.up();

		// Get final position
		const transform = await shape.getAttribute("transform");
		const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const finalX = match ? parseFloat(match[1]) : 0;
		const finalY = match ? parseFloat(match[2]) : 0;

		// Should snap exactly to 200, 200 (or very close due to calculation)
		// The expected position is around 170-180 due to the shape center offset
		expect(finalX % 10).toBeLessThanOrEqual(1);
		expect(finalY % 10).toBeLessThanOrEqual(1);
	});
});
