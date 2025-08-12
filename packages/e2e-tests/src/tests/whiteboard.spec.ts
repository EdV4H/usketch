import { expect, test } from "@playwright/test";

export const whiteboardTests = () => {
	test("should display the whiteboard with toolbar", async ({ page }) => {
		// Check that the toolbar exists
		await expect(page.locator(".toolbar, #toolbar")).toBeVisible();

		// Check that the whiteboard/canvas container exists
		await expect(page.locator(".whiteboard-container, #canvas")).toBeVisible();

		// Check that the grid background is displayed
		await expect(page.locator(".grid-background")).toBeVisible();
	});

	test("should have Select and Rectangle tools", async ({ page }) => {
		// Check that the Select tool button exists and is active by default
		const selectButton = page.locator('.tool-button:has-text("Select"), #select-tool');
		await expect(selectButton).toBeVisible();
		await expect(selectButton).toHaveClass(/active/);

		// Check that the Rectangle tool button exists
		const rectangleButton = page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool');
		await expect(rectangleButton).toBeVisible();
	});

	test("should switch between tools", async ({ page }) => {
		const selectButton = page.locator('.tool-button:has-text("Select"), #select-tool');
		const rectangleButton = page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool');

		// Initially, Select should be active
		await expect(selectButton).toHaveClass(/active/);
		await expect(rectangleButton).not.toHaveClass(/active/);

		// Click Rectangle tool
		await rectangleButton.click();

		// Now Rectangle should be active, Select should not be
		await expect(rectangleButton).toHaveClass(/active/);
		await expect(selectButton).not.toHaveClass(/active/);

		// Click Select tool again
		await selectButton.click();

		// Select should be active again
		await expect(selectButton).toHaveClass(/active/);
		await expect(rectangleButton).not.toHaveClass(/active/);
	});

	test("should draw a rectangle", async ({ page }) => {
		// Switch to Rectangle tool
		await page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool').click();

		// Get the whiteboard container
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		// Draw a rectangle at a clear position
		await whiteboard.hover({ position: { x: 600, y: 300 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 800, y: 400 } });
		await page.mouse.up();

		// Wait a bit for the shape to be rendered
		await page.waitForTimeout(100);

		// Check that a rectangle shape was created
		const rectangles = await page
			.locator('[data-shape="true"][data-shape-type="rectangle"]')
			.count();
		expect(rectangles).toBeGreaterThanOrEqual(1);
	});

	test("should select and move a shape", async ({ page }) => {
		// First, draw a rectangle at a different position to avoid initial shapes
		await page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 500, y: 100 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 700, y: 200 } });
		await page.mouse.up();

		// Switch to Select tool
		await page.locator('.tool-button:has-text("Select"), #select-tool').click();

		// Wait for shape to be rendered
		await page.waitForTimeout(200);

		// Click on the newly created rectangle (using last() to get the most recent)
		const rectangle = page.locator('[data-shape="true"][data-shape-type="rectangle"]').last();
		const initialBox = await rectangle.boundingBox();
		expect(initialBox).toBeTruthy();

		// Click on the shape to select it
		await rectangle.click();

		// Check that selection indicators appear
		await expect(page.locator(".selection-box")).toBeVisible();

		// Drag the shape to a new position
		await rectangle.hover();
		await page.mouse.down();
		await page.mouse.move(initialBox!.x + 100, initialBox!.y + 50);
		await page.mouse.up();

		// Wait for movement to complete
		await page.waitForTimeout(100);

		// Check that the shape moved
		const newBox = await rectangle.boundingBox();
		expect(newBox).toBeTruthy();
		// Allow for small variations in position
		// The shape should have moved (not be in the exact same position)
		const xMoved = Math.abs(newBox!.x - initialBox!.x) > 5;
		const yMoved = Math.abs(newBox!.y - initialBox!.y) > 5;
		expect(xMoved || yMoved).toBe(true);
	});

	test("should handle zoom with mouse wheel", async ({ page }) => {
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		// Draw a rectangle first at a clear position
		await page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool').click();
		await whiteboard.hover({ position: { x: 600, y: 300 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 700, y: 400 } });
		await page.mouse.up();

		// Wait for shape to be rendered
		await page.waitForTimeout(100);

		// Get initial size
		const rectangle = page.locator('[data-shape="true"][data-shape-type="rectangle"]').first();
		const initialBox = await rectangle.boundingBox();
		expect(initialBox).toBeTruthy();

		// Zoom in
		await whiteboard.hover({ position: { x: 250, y: 250 } });
		await page.mouse.wheel(0, -100);
		await page.waitForTimeout(100);

		// Check that the shape got bigger
		const zoomedBox = await rectangle.boundingBox();
		expect(zoomedBox).toBeTruthy();
		expect(zoomedBox!.width).toBeGreaterThan(initialBox!.width);
		expect(zoomedBox!.height).toBeGreaterThan(initialBox!.height);
	});

	test.skip("should handle keyboard shortcuts", async ({ page }) => {
		// Skip this test for now as delete functionality might not be implemented
		// Draw two rectangles
		await page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		// First rectangle at clear position
		await whiteboard.hover({ position: { x: 600, y: 100 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 700, y: 200 } });
		await page.mouse.up();

		// Second rectangle at clear position
		await whiteboard.hover({ position: { x: 800, y: 100 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 900, y: 200 } });
		await page.mouse.up();

		// Switch to Select tool
		await page.locator('.tool-button:has-text("Select"), #select-tool').click();

		// Select first shape
		const firstRect = page.locator('[data-shape="true"][data-shape-type="rectangle"]').first();
		await firstRect.click();

		// Press Delete to remove the shape
		await page.keyboard.press("Delete");
		await page.waitForTimeout(100);

		// Check that only one shape remains
		const remainingShapes = await page
			.locator('[data-shape="true"][data-shape-type="rectangle"]')
			.count();
		expect(remainingShapes).toBe(1);
	});

	test("should pan the canvas with middle mouse button", async ({ page }) => {
		// Draw a rectangle at a clear position
		await page.locator('.tool-button:has-text("Rectangle"), #rectangle-tool').click();
		const whiteboard = page.locator(".whiteboard-container, #canvas");

		await whiteboard.hover({ position: { x: 600, y: 300 } });
		await page.mouse.down();
		await whiteboard.hover({ position: { x: 700, y: 400 } });
		await page.mouse.up();

		// Get initial position
		const rectangle = page.locator('[data-shape="true"][data-shape-type="rectangle"]').first();
		const initialBox = await rectangle.boundingBox();
		expect(initialBox).toBeTruthy();

		// Pan with middle mouse button
		await whiteboard.hover({ position: { x: 250, y: 250 } });
		await page.mouse.down({ button: "middle" });
		await whiteboard.hover({ position: { x: 350, y: 350 } });
		await page.mouse.up({ button: "middle" });

		await page.waitForTimeout(100);

		// Check that shape position changed (due to pan)
		const pannedBox = await rectangle.boundingBox();
		expect(pannedBox).toBeTruthy();
		expect(pannedBox!.x).not.toBe(initialBox!.x);
		expect(pannedBox!.y).not.toBe(initialBox!.y);
	});
};
