import { expect, test } from "@playwright/test";

test.describe("Undo/Redo Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
		// Wait for initial shape to be rendered
		await page.waitForTimeout(500);
	});

	test("should show undo/redo buttons in toolbar", async ({ page }) => {
		// Check that history controls are visible
		const historyControls = page.locator(".history-controls");
		await expect(historyControls).toBeVisible();

		// Check undo button exists
		const undoButton = page.locator('button[aria-label="Undo"]');
		await expect(undoButton).toBeVisible();

		// Check redo button exists
		const redoButton = page.locator('button[aria-label="Redo"]');
		await expect(redoButton).toBeVisible();
	});

	test("should undo and redo shape creation", async ({ page }) => {
		// Clear any existing shapes first
		const initialShapes = await page.locator('[data-shape="true"]').count();

		// Switch to rectangle tool
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create a rectangle
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 200);
		await page.mouse.up();

		// Verify shape was created
		await page.waitForTimeout(100);
		let shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 1);

		// Undo the creation
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Verify shape was removed
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes);

		// Redo the creation
		await page.click('button[aria-label="Redo"]');
		await page.waitForTimeout(100);

		// Verify shape was restored
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 1);
	});

	test("should undo and redo shape deletion", async ({ page }) => {
		// Get initial shape count
		const initialShapes = await page.locator('[data-shape="true"]').count();

		// Switch to rectangle tool and create a shape
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create a rectangle
		await page.mouse.move(box.x + 200, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 400, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Select the shape by clicking on it
		await page.mouse.click(box.x + 300, box.y + 200);
		await page.waitForTimeout(100);

		// Delete the selected shape
		await page.keyboard.press("Delete");
		await page.waitForTimeout(100);

		// Verify shape was deleted
		let shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes);

		// Undo the deletion
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Verify shape was restored
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 1);

		// Redo the deletion
		await page.click('button[aria-label="Redo"]');
		await page.waitForTimeout(100);

		// Verify shape was deleted again
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes);
	});

	test("should undo and redo shape movement", async ({ page }) => {
		// Switch to rectangle tool
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create a rectangle
		const startX = box.x + 100;
		const startY = box.y + 100;
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(startX + 100, startY + 50);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Select and move the shape
		await page.mouse.move(startX + 50, startY + 25);
		await page.mouse.down();
		await page.mouse.move(startX + 150, startY + 125, { steps: 10 });
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Get shape position after move
		const shapeAfterMove = await page.locator('[data-shape="true"]').first().boundingBox();

		// Undo the movement
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(200);

		// Get shape position after undo
		const shapeAfterUndo = await page.locator('[data-shape="true"]').first().boundingBox();

		// Verify shape moved back (approximately)
		if (shapeAfterMove && shapeAfterUndo) {
			expect(Math.abs(shapeAfterUndo.x - startX)).toBeLessThan(50);
			expect(Math.abs(shapeAfterUndo.y - startY)).toBeLessThan(50);
		}

		// Redo the movement
		await page.click('button[aria-label="Redo"]');
		await page.waitForTimeout(200);

		// Get shape position after redo
		const shapeAfterRedo = await page.locator('[data-shape="true"]').first().boundingBox();

		// Verify shape moved forward again
		if (shapeAfterMove && shapeAfterRedo) {
			expect(Math.abs(shapeAfterRedo.x - shapeAfterMove.x)).toBeLessThan(10);
			expect(Math.abs(shapeAfterRedo.y - shapeAfterMove.y)).toBeLessThan(10);
		}
	});

	test("should handle multiple undo/redo operations", async ({ page }) => {
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Get initial count
		const initialShapes = await page.locator('[data-shape="true"]').count();

		// Create 3 rectangles
		await page.click('button:has-text("四角形")');

		for (let i = 0; i < 3; i++) {
			const x = box.x + 100 + i * 120;
			const y = box.y + 100;
			await page.mouse.move(x, y);
			await page.mouse.down();
			await page.mouse.move(x + 80, y + 60);
			await page.mouse.up();
			await page.waitForTimeout(100);
		}

		// Verify 3 shapes were created
		let shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 3);

		// Undo 3 times
		for (let i = 0; i < 3; i++) {
			await page.click('button[aria-label="Undo"]');
			await page.waitForTimeout(100);
		}

		// Verify all shapes were removed
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes);

		// Redo 2 times
		for (let i = 0; i < 2; i++) {
			await page.click('button[aria-label="Redo"]');
			await page.waitForTimeout(100);
		}

		// Verify 2 shapes were restored
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 2);
	});

	test("should use keyboard shortcuts for undo/redo", async ({ page }) => {
		// Create a shape first
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		await page.mouse.move(box.x + 150, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 200);
		await page.mouse.up();
		await page.waitForTimeout(100);

		const initialShapes = await page.locator('[data-shape="true"]').count();

		// Create another shape
		await page.mouse.move(box.x + 300, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 400, box.y + 200);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Verify shape was created
		let shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 1);

		// Use Cmd+Z (or Ctrl+Z) to undo
		const isMac = process.platform === "darwin";
		await page.keyboard.press(isMac ? "Meta+z" : "Control+z");
		await page.waitForTimeout(100);

		// Verify shape was removed
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes);

		// Use Cmd+Shift+Z (or Ctrl+Shift+Z) to redo
		await page.keyboard.press(isMac ? "Meta+Shift+z" : "Control+Shift+z");
		await page.waitForTimeout(100);

		// Verify shape was restored
		shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(initialShapes + 1);
	});

	test("should disable undo when nothing to undo", async ({ page }) => {
		// Clear history by refreshing the page
		await page.reload();
		await page.waitForSelector(".whiteboard-canvas");

		// Check undo button is disabled initially
		const undoButton = page.locator('button[aria-label="Undo"]');
		await expect(undoButton).toBeDisabled();

		// Create a shape to enable undo
		await page.click('button:has-text("四角形")');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Check undo button is now enabled
		await expect(undoButton).toBeEnabled();
	});

	test("should disable redo when nothing to redo", async ({ page }) => {
		// Check redo button is disabled initially
		const redoButton = page.locator('button[aria-label="Redo"]');
		await expect(redoButton).toBeDisabled();

		// Create and undo an action
		await page.click('button:has-text("四角形")');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(100);

		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Check redo button is now enabled
		await expect(redoButton).toBeEnabled();

		// Redo the action
		await page.click('button[aria-label="Redo"]');
		await page.waitForTimeout(100);

		// Check redo button is disabled again
		await expect(redoButton).toBeDisabled();
	});
});
