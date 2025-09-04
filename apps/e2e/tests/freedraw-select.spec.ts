import { expect, test } from "@playwright/test";

test.describe("FreeDraw Selection and Movement", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should select and move a freedraw shape", async ({ page }) => {
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// First, draw a freedraw shape
		await page.click('button:has-text("Draw")');

		// Draw a line
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
		await page.mouse.up();

		// Verify shape was created
		let shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(1);

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Click on the freedraw shape to select it
		await page.mouse.click(box.x + 150, box.y + 150);

		// Verify shape is selected
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(1);

		// Drag the shape to a new position
		await page.mouse.move(box.x + 150, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 250, { steps: 5 });
		await page.mouse.up();

		// Verify shape still exists and is still selected
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(1);

		// The shape should have moved (we can't easily verify exact position in E2E,
		// but we can verify it's still selectable at the new location)
		await page.mouse.click(box.x + 50, box.y + 50); // Click outside to deselect
		await page.waitForTimeout(100);

		const deselected = await page.locator('[data-selected="true"]').count();
		expect(deselected).toBe(0);

		// Click at new position to reselect
		await page.mouse.click(box.x + 250, box.y + 250);
		const reselected = await page.locator('[data-selected="true"]').count();
		expect(reselected).toBe(1);
	});

	test("should select and move multiple shapes including freedraw", async ({ page }) => {
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a freedraw shape
		await page.click('button:has-text("Draw")');
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 150, box.y + 150, { steps: 5 });
		await page.mouse.up();

		// Draw a rectangle
		await page.click('button:has-text("Rectangle")');
		await page.mouse.move(box.x + 200, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 200);
		await page.mouse.up();

		// Verify both shapes were created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(2);

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Select both shapes with box selection
		await page.mouse.move(box.x + 50, box.y + 50);
		await page.mouse.down();
		await page.mouse.move(box.x + 350, box.y + 250);
		await page.mouse.up();

		// Verify both shapes are selected
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(2);

		// Move both shapes together
		await page.mouse.move(box.x + 150, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 250, { steps: 5 });
		await page.mouse.up();

		// Verify both shapes are still selected
		const stillSelected = await page.locator('[data-selected="true"]').count();
		expect(stillSelected).toBe(2);
	});

	test("should directly drag unselected freedraw shape", async ({ page }) => {
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a freedraw shape
		await page.click('button:has-text("Draw")');
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 150, { steps: 5 });
		await page.mouse.up();

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Directly drag the shape without selecting first
		await page.mouse.move(box.x + 150, box.y + 125);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 225, { steps: 5 });
		await page.mouse.up();

		// Verify shape is selected after drag
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(1);

		// Verify shape still exists
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(1);
	});
});
