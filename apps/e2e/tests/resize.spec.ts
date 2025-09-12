import { expect, test } from "@playwright/test";

test.describe("Shape Resize Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173?e2e=true");
		// Wait for canvas to be ready (increase timeout)
		await page.waitForSelector(".whiteboard-canvas", { timeout: 10000 });
		// Wait for toolbar to be ready - check for any tool button
		await page.waitForSelector('[data-testid="tool-select"]', { timeout: 5000 });
	});

	test("should display resize handles when shape is selected", async ({ page }) => {
		// Create a rectangle
		await page.click('[data-testid="tool-rectangle"]');

		// Draw rectangle
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(400, 300);
		await page.mouse.up();

		// Wait a bit for shape to be created
		await page.waitForTimeout(500);

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Wait a bit for tool switch
		await page.waitForTimeout(500);

		// Click on the shape to select it
		await page.click(".whiteboard-canvas", { position: { x: 300, y: 250 } });

		// Wait for selection to register
		await page.waitForTimeout(500);

		// Debug: Take screenshot
		await page.screenshot({ path: "test-results/resize-handles-debug.png" });

		// Check if resize handles are visible
		const handles = await page.locator("[data-resize-handle]").count();
		expect(handles).toBeGreaterThan(0);
	});

	test("should resize shape when dragging handle", async ({ page }) => {
		// Create a rectangle
		await page.click('[data-testid="tool-rectangle"]');

		// Draw rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(300, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Click on the shape to select it
		await page.click(".whiteboard-canvas", { position: { x: 200, y: 150 } });

		// Wait for handles to appear
		await page.waitForSelector("[data-resize-handle]", { timeout: 5000 });

		// Get initial shape dimensions
		const shapeBefore = await page.locator("[data-shape-id]").first().boundingBox();

		// Find SE (bottom-right) resize handle
		const seHandle = await page.locator('[data-resize-handle="se"]').boundingBox();
		if (!seHandle) {
			throw new Error("SE resize handle not found");
		}

		// Drag the SE handle to resize
		await page.mouse.move(seHandle.x + seHandle.width / 2, seHandle.y + seHandle.height / 2);
		await page.mouse.down();
		await page.mouse.move(seHandle.x + 50, seHandle.y + 50);
		await page.mouse.up();

		// Get shape dimensions after resize
		const shapeAfter = await page.locator("[data-shape-id]").first().boundingBox();

		// Verify shape was resized
		expect(shapeAfter?.width).toBeGreaterThan(shapeBefore?.width || 0);
		expect(shapeAfter?.height).toBeGreaterThan(shapeBefore?.height || 0);
	});

	test("should maintain aspect ratio with Shift key", async ({ page }) => {
		// Create a square
		await page.click('[data-testid="tool-rectangle"]');

		// Draw square
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Click on the shape to select it
		await page.click(".whiteboard-canvas", { position: { x: 150, y: 150 } });

		// Wait for handles to appear
		await page.waitForSelector("[data-resize-handle]", { timeout: 5000 });

		// Get initial shape dimensions
		const shapeBefore = await page.locator("[data-shape-id]").first().boundingBox();
		const initialAspectRatio = shapeBefore ? shapeBefore.width / shapeBefore.height : 1;

		// Find SE (bottom-right) resize handle
		const seHandle = await page.locator('[data-resize-handle="se"]').boundingBox();
		if (!seHandle) {
			throw new Error("SE resize handle not found");
		}

		// Drag with Shift held down
		await page.keyboard.down("Shift");
		await page.mouse.move(seHandle.x + seHandle.width / 2, seHandle.y + seHandle.height / 2);
		await page.mouse.down();
		await page.mouse.move(seHandle.x + 50, seHandle.y + 25); // Different x and y to test aspect ratio
		await page.mouse.up();
		await page.keyboard.up("Shift");

		// Get shape dimensions after resize
		const shapeAfter = await page.locator("[data-shape-id]").first().boundingBox();
		const finalAspectRatio = shapeAfter ? shapeAfter.width / shapeAfter.height : 1;

		// Verify aspect ratio was maintained (within tolerance)
		expect(Math.abs(finalAspectRatio - initialAspectRatio)).toBeLessThan(0.1);
	});

	test("should enforce minimum size constraints", async ({ page }) => {
		// Create a rectangle
		await page.click('[data-testid="tool-rectangle"]');

		// Draw rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Click on the shape to select it
		await page.click(".whiteboard-canvas", { position: { x: 150, y: 150 } });

		// Wait for handles to appear
		await page.waitForSelector("[data-resize-handle]", { timeout: 5000 });

		// Find NW (top-left) resize handle
		const nwHandle = await page.locator('[data-resize-handle="nw"]').boundingBox();
		if (!nwHandle) {
			throw new Error("NW resize handle not found");
		}

		// Try to resize to very small size
		await page.mouse.move(nwHandle.x + nwHandle.width / 2, nwHandle.y + nwHandle.height / 2);
		await page.mouse.down();
		await page.mouse.move(nwHandle.x + 200, nwHandle.y + 200); // Try to make it very small
		await page.mouse.up();

		// Get shape dimensions after resize
		const shapeAfter = await page.locator("[data-shape-id]").first().boundingBox();

		// Verify minimum size was enforced (20px minimum)
		expect(shapeAfter?.width).toBeGreaterThanOrEqual(20);
		expect(shapeAfter?.height).toBeGreaterThanOrEqual(20);
	});

	test("should cancel resize with ESC key", async ({ page }) => {
		// Create a rectangle
		await page.click('[data-testid="tool-rectangle"]');

		// Draw rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(300, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Click on the shape to select it
		await page.click(".whiteboard-canvas", { position: { x: 200, y: 150 } });

		// Wait for handles to appear
		await page.waitForSelector("[data-resize-handle]", { timeout: 5000 });

		// Get initial shape dimensions
		const shapeBefore = await page.locator("[data-shape-id]").first().boundingBox();

		// Find SE (bottom-right) resize handle
		const seHandle = await page.locator('[data-resize-handle="se"]').boundingBox();
		if (!seHandle) {
			throw new Error("SE resize handle not found");
		}

		// Start dragging but cancel with ESC
		await page.mouse.move(seHandle.x + seHandle.width / 2, seHandle.y + seHandle.height / 2);
		await page.mouse.down();
		await page.mouse.move(seHandle.x + 50, seHandle.y + 50);
		await page.keyboard.press("Escape");
		await page.mouse.up();

		// Get shape dimensions after cancelled resize
		const shapeAfter = await page.locator("[data-shape-id]").first().boundingBox();

		// Verify shape dimensions remained the same
		expect(shapeAfter?.width).toBeCloseTo(shapeBefore?.width || 0, 1);
		expect(shapeAfter?.height).toBeCloseTo(shapeBefore?.height || 0, 1);
	});
});
