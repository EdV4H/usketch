const { expect, test } = require("@playwright/test");

test.describe("Shape-to-Shape Snap Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		// Wait for the canvas to be ready
		await page.waitForSelector('[data-testid="whiteboard-canvas"]');
	});

	test("should snap to shape edges when dragging close", async ({ page }) => {
		// Create first rectangle (target)
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		// Create second rectangle (to be dragged)
		await page.mouse.move(400, 200);
		await page.mouse.down();
		await page.mouse.move(500, 300);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second shape
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBe(2);
		await shapes[1].click();

		// Get initial position of second shape
		let transform = await shapes[1].getAttribute("transform");
		let match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const initialX = match ? parseFloat(match[1]) : 0;
		const initialY = match ? parseFloat(match[2]) : 0;

		// Drag second shape close to first shape's right edge (within snap threshold)
		await page.mouse.move(initialX + 50, initialY + 50);
		await page.mouse.down();
		// Move to position that should snap to right edge of first shape (x=300)
		await page.mouse.move(308, initialY + 50); // 308 should snap to 300
		await page.mouse.up();

		// Get final position
		transform = await shapes[1].getAttribute("transform");
		match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const finalX = match ? parseFloat(match[1]) : 0;

		// Should snap to x=300 (right edge of first shape)
		expect(Math.abs(finalX - 300)).toBeLessThanOrEqual(2);
	});

	test("should snap to shape center alignment", async ({ page }) => {
		// Create first rectangle (target)
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		// Create second rectangle (to be dragged)
		await page.mouse.move(400, 350);
		await page.mouse.down();
		await page.mouse.move(500, 450);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second shape
		const shapes = await page.locator("[data-shape-id]").all();
		await shapes[1].click();

		// Get initial position
		let transform = await shapes[1].getAttribute("transform");
		let match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const initialX = match ? parseFloat(match[1]) : 0;
		const initialY = match ? parseFloat(match[2]) : 0;

		// Drag to align centers horizontally (center of first shape is at x=250)
		await page.mouse.move(initialX + 50, initialY + 50);
		await page.mouse.down();
		await page.mouse.move(208, initialY + 50); // Should snap to center x=200 (250-50)
		await page.mouse.up();

		// Get final position
		transform = await shapes[1].getAttribute("transform");
		match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const finalX = match ? parseFloat(match[1]) : 0;

		// Centers should be aligned (both at x=250)
		const firstCenterX = 250; // 200 + 100/2
		const secondCenterX = finalX + 50; // finalX + 100/2
		expect(Math.abs(firstCenterX - secondCenterX)).toBeLessThanOrEqual(2);
	});

	test("should show snap guides when snapping", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(350, 200);
		await page.mouse.down();
		await page.mouse.move(450, 300);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second shape
		const shapes = await page.locator("[data-shape-id]").all();
		await shapes[1].click();

		// Start dragging
		await page.mouse.move(400, 250);
		await page.mouse.down();
		await page.mouse.move(250, 250); // Move to align centers

		// Check for snap guidelines
		const guidelines = await page.locator(".snap-guidelines").first();
		expect(guidelines).toBeTruthy();

		// Check for guide lines
		const guideLines = await page.locator(".snap-guidelines line");
		const count = await guideLines.count();
		expect(count).toBeGreaterThan(0);

		await page.mouse.up();
	});

	test("should disable snap when Alt key is pressed", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(350, 207);
		await page.mouse.down();
		await page.mouse.move(450, 307);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second shape
		const shapes = await page.locator("[data-shape-id]").all();
		await shapes[1].click();

		// Get initial position
		let transform = await shapes[1].getAttribute("transform");
		let match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const initialX = match ? parseFloat(match[1]) : 0;
		const initialY = match ? parseFloat(match[2]) : 0;

		// Drag with Alt key pressed (no snapping)
		await page.keyboard.down("Alt");
		await page.mouse.move(initialX + 50, initialY + 50);
		await page.mouse.down();
		await page.mouse.move(307, 207); // Would snap without Alt
		await page.mouse.up();
		await page.keyboard.up("Alt");

		// Get final position
		transform = await shapes[1].getAttribute("transform");
		match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const finalX = match ? parseFloat(match[1]) : 0;
		const finalY = match ? parseFloat(match[2]) : 0;

		// Should NOT snap to edges (position should be close to mouse position)
		// The exact position depends on the drag offset
		expect(finalX).toBeGreaterThan(250);
		expect(finalX).toBeLessThan(310);
		expect(finalY).toBeGreaterThan(150);
		expect(finalY).toBeLessThan(210);
	});

	test("should snap to multiple shapes and choose closest", async ({ page }) => {
		// Create three rectangles in a row
		await page.click('[data-testid="tool-rectangle"]');

		// First rectangle
		await page.mouse.move(100, 200);
		await page.mouse.down();
		await page.mouse.move(200, 300);
		await page.mouse.up();

		// Second rectangle
		await page.mouse.move(250, 200);
		await page.mouse.down();
		await page.mouse.move(350, 300);
		await page.mouse.up();

		// Third rectangle
		await page.mouse.move(400, 200);
		await page.mouse.down();
		await page.mouse.move(500, 300);
		await page.mouse.up();

		// Create a fourth rectangle to drag
		await page.mouse.move(300, 350);
		await page.mouse.down();
		await page.mouse.move(400, 450);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the fourth shape
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBe(4);
		await shapes[3].click();

		// Drag close to second rectangle (should snap to it, not others)
		await page.mouse.move(350, 400);
		await page.mouse.down();
		await page.mouse.move(300, 315); // Close to second rectangle's bottom
		await page.mouse.up();

		// Get final position
		const transform = await shapes[3].getAttribute("transform");
		const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const finalY = match ? parseFloat(match[2]) : 0;

		// Should snap to y=300 (bottom of second rectangle)
		expect(Math.abs(finalY - 300)).toBeLessThanOrEqual(2);
	});

	test("should maintain snap while dragging along edge", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(400, 300);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(200, 350);
		await page.mouse.down();
		await page.mouse.move(300, 450);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select the second shape
		const shapes = await page.locator("[data-shape-id]").all();
		await shapes[1].click();

		// Start dragging
		await page.mouse.move(250, 400);
		await page.mouse.down();

		// Move horizontally while maintaining vertical snap
		await page.mouse.move(250, 305); // Snap to bottom edge
		await page.waitForTimeout(50);

		// Move along the edge
		await page.mouse.move(300, 305);
		await page.waitForTimeout(50);
		await page.mouse.move(350, 305);
		await page.waitForTimeout(50);

		await page.mouse.up();

		// Get final position
		const transform = await shapes[1].getAttribute("transform");
		const match = transform?.match(/translate\(([^,]+),\s*([^)]+)\)/);
		const finalY = match ? parseFloat(match[2]) : 0;

		// Should still be snapped to bottom edge (y=300)
		expect(Math.abs(finalY - 300)).toBeLessThanOrEqual(2);
	});
});
