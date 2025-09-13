import { expect, test } from "@playwright/test";

test.describe("Shape Alignment Feature", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		// Wait for the app to load
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should show alignment guides when dragging a shape near another shape", async ({
		page,
	}) => {
		// Create first rectangle
		await page.click('[data-tool="rectangle"]');
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
		await page.click('[data-tool="select"]');

		// Select and drag the second rectangle
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Drag towards the first rectangle to trigger alignment
		await page.mouse.move(250, 150);

		// Check if alignment guides are visible
		const alignmentLayer = await page.locator(".alignment-layer");
		await expect(alignmentLayer).toBeVisible();

		// Check if there are guide lines
		const guides = await alignmentLayer.locator("line");
		const guidesCount = await guides.count();
		expect(guidesCount).toBeGreaterThan(0);

		await page.mouse.up();
	});

	test("should snap shape position when within snap threshold", async ({ page }) => {
		// Create first rectangle at a known position
		await page.click('[data-tool="rectangle"]');
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
		await page.click('[data-tool="select"]');

		// Select the second rectangle
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Drag close to align with the first rectangle (within snap threshold)
		await page.mouse.move(202, 150); // 2px away from perfect alignment
		await page.mouse.up();

		// Get the actual position of the shape after snapping
		// Note: This assumes shapes have data attributes with their positions
		const shape = await page.locator("[data-shape-id]").last();
		const boundingBox = await shape.boundingBox();

		if (boundingBox) {
			// Check if the shape snapped to the expected position
			// It should align with the right edge of the first rectangle (x=200)
			expect(Math.abs(boundingBox.x - 200)).toBeLessThanOrEqual(1);
		}
	});

	test("should disable alignment when Alt key is pressed", async ({ page }) => {
		// Create two rectangles
		await page.click('[data-tool="rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-tool="select"]');

		// Select and drag with Alt key pressed
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Hold Alt key and drag
		await page.keyboard.down("Alt");
		await page.mouse.move(202, 150);

		// Check that alignment guides are NOT visible
		const alignmentLayer = await page.locator(".alignment-layer");
		const guides = await alignmentLayer.locator("line");
		const guidesCount = await guides.count();
		expect(guidesCount).toBe(0);

		await page.keyboard.up("Alt");
		await page.mouse.up();
	});

	test("should show stronger snap with Shift key pressed", async ({ page }) => {
		// Create two rectangles
		await page.click('[data-tool="rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		await page.mouse.move(320, 100);
		await page.mouse.down();
		await page.mouse.move(420, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-tool="select"]');

		// Select and drag with Shift key for strong snap
		await page.mouse.move(370, 150);
		await page.mouse.down();

		// Hold Shift key and drag (further away but within strong snap threshold)
		await page.keyboard.down("Shift");
		await page.mouse.move(212, 150); // 12px away from alignment
		await page.mouse.up();
		await page.keyboard.up("Shift");

		// Check if the shape snapped despite being further away
		const shape = await page.locator("[data-shape-id]").last();
		const boundingBox = await shape.boundingBox();

		if (boundingBox) {
			// Should still snap to x=200 with strong snap
			expect(Math.abs(boundingBox.x - 200)).toBeLessThanOrEqual(2);
		}
	});

	test("should align multiple selected shapes together", async ({ page }) => {
		// Create three rectangles
		await page.click('[data-tool="rectangle"]');

		// First rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		// Second rectangle
		await page.mouse.move(200, 100);
		await page.mouse.down();
		await page.mouse.move(250, 150);
		await page.mouse.up();

		// Third rectangle (target for alignment)
		await page.mouse.move(100, 300);
		await page.mouse.down();
		await page.mouse.move(200, 400);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-tool="select"]');

		// Select first two rectangles with Shift+click
		await page.mouse.move(125, 125);
		await page.mouse.click(125, 125);

		await page.keyboard.down("Shift");
		await page.mouse.click(225, 125);
		await page.keyboard.up("Shift");

		// Drag the selected shapes
		await page.mouse.move(125, 125);
		await page.mouse.down();
		await page.mouse.move(125, 302); // Close to third rectangle

		// Check for alignment guides
		const alignmentLayer = await page.locator(".alignment-layer");
		await expect(alignmentLayer).toBeVisible();

		const guides = await alignmentLayer.locator("line");
		const guidesCount = await guides.count();
		expect(guidesCount).toBeGreaterThan(0);

		await page.mouse.up();
	});

	test("should clear alignment guides after releasing the mouse", async ({ page }) => {
		// Create two rectangles
		await page.click('[data-tool="rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-tool="select"]');

		// Select and drag
		await page.mouse.move(350, 150);
		await page.mouse.down();
		await page.mouse.move(202, 150);

		// Guides should be visible while dragging
		const alignmentLayer = await page.locator(".alignment-layer");
		let guides = await alignmentLayer.locator("line");
		let guidesCount = await guides.count();
		expect(guidesCount).toBeGreaterThan(0);

		// Release mouse
		await page.mouse.up();

		// Wait a bit for the guides to clear
		await page.waitForTimeout(100);

		// Guides should be cleared after releasing
		guides = await alignmentLayer.locator("line");
		guidesCount = await guides.count();
		expect(guidesCount).toBe(0);
	});
});
