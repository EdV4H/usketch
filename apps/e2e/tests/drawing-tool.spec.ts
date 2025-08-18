import { expect, test } from "@playwright/test";

test.describe("Drawing Tool", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:3001/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should switch to drawing tool", async ({ page }) => {
		// Click draw tool button
		await page.click('button:has-text("Draw")');

		// Verify tool is selected
		const drawButton = page.locator('button:has-text("Draw")');
		await expect(drawButton).toHaveClass(/active/);
	});

	test("should draw a line on canvas", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a line
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
		await page.mouse.up();

		// Verify shape was created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBeGreaterThan(0);
	});

	test("should draw multiple strokes", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw first stroke
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 150, box.y + 150, { steps: 5 });
		await page.mouse.up();

		// Draw second stroke
		await page.mouse.move(box.x + 200, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 150, { steps: 5 });
		await page.mouse.up();

		// Verify two shapes were created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(2);
	});

	test("should cancel drawing with Escape key", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Start drawing
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });

		// Press Escape to cancel
		await page.keyboard.press("Escape");
		await page.mouse.up();

		// Verify no shape was created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(0);
	});

	test("should create curved paths with smooth strokes", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a curved path
		await page.mouse.move(box.x + 100, box.y + 150);
		await page.mouse.down();

		// Create a smooth curve
		const points = [
			{ x: 120, y: 140 },
			{ x: 140, y: 130 },
			{ x: 160, y: 125 },
			{ x: 180, y: 130 },
			{ x: 200, y: 140 },
			{ x: 220, y: 155 },
			{ x: 240, y: 170 },
		];

		for (const point of points) {
			await page.mouse.move(box.x + point.x, box.y + point.y);
		}

		await page.mouse.up();

		// Verify shape was created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(1);
	});

	test("should not create shape if drawing is too small", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a very small line (just click)
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.up();

		// Verify no shape was created (too small)
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(0);
	});

	test("should switch back to select tool after drawing", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a line
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
		await page.mouse.up();

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Verify select tool is active
		const selectButton = page.locator('button:has-text("Select")');
		await expect(selectButton).toHaveClass(/active/);

		// Click on the drawn shape to select it
		await page.click('[data-shape="true"]');

		// Verify shape is selected
		const selectedShape = await page.locator('[data-selected="true"]').count();
		expect(selectedShape).toBe(1);
	});

	test("should maintain drawing state between tool switches", async ({ page }) => {
		// Switch to draw tool
		await page.click('button:has-text("Draw")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw first stroke
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 150, box.y + 150, { steps: 5 });
		await page.mouse.up();

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Switch back to draw tool
		await page.click('button:has-text("Draw")');

		// Draw second stroke
		await page.mouse.move(box.x + 200, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 150, { steps: 5 });
		await page.mouse.up();

		// Verify both shapes exist
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(2);
	});
});
