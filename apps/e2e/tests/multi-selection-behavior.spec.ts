import { expect, test } from "@playwright/test";

test.describe("Multi-Selection Behavior Issues Investigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
		await page.waitForTimeout(500);
	});

	test("should properly select multiple shapes with Shift+Click", async ({ page }) => {
		// Create 3 rectangles
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create first rectangle
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Create second rectangle
		await page.mouse.move(box.x + 250, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 350, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Create third rectangle
		await page.mouse.move(box.x + 400, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 500, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Step 1: Click first shape (normal selection)
		await page.mouse.click(box.x + 150, box.y + 125);
		await page.waitForTimeout(100);

		let selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(1);

		// Step 2: Shift+Click second shape (should add to selection)
		await page.keyboard.down("Shift");
		await page.mouse.click(box.x + 300, box.y + 125);
		await page.keyboard.up("Shift");
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(2);

		// Step 3: Shift+Click third shape (should add to selection)
		await page.keyboard.down("Shift");
		await page.mouse.click(box.x + 450, box.y + 125);
		await page.keyboard.up("Shift");
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(3);

		// Step 4: Shift+Click already selected shape (should deselect it)
		await page.keyboard.down("Shift");
		await page.mouse.click(box.x + 300, box.y + 125);
		await page.keyboard.up("Shift");
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(2);

		// Step 5: Normal click (should clear selection and select only clicked shape)
		await page.mouse.click(box.x + 300, box.y + 125);
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(1);
	});

	test("should properly handle drag selection (rubber band)", async ({ page }) => {
		// Create a grid of shapes
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create 2x2 grid of rectangles
		const positions = [
			{ x: 200, y: 200 }, // top-left
			{ x: 350, y: 200 }, // top-right
			{ x: 200, y: 350 }, // bottom-left
			{ x: 350, y: 350 }, // bottom-right
		];

		for (const pos of positions) {
			await page.mouse.move(box.x + pos.x, box.y + pos.y);
			await page.mouse.down();
			await page.mouse.move(box.x + pos.x + 80, box.y + pos.y + 80);
			await page.mouse.up();
			await page.waitForTimeout(50);
		}

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Test 1: Select top row with drag selection
		await page.mouse.move(box.x + 150, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 480, box.y + 320);
		await page.mouse.up();
		await page.waitForTimeout(200);

		let selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(4); // Should select all 4 shapes

		// Clear selection by clicking empty area
		await page.mouse.click(box.x + 100, box.y + 100);
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(0);

		// Test 2: Select only top two shapes
		await page.mouse.move(box.x + 150, box.y + 150);
		await page.mouse.down();
		await page.mouse.move(box.x + 480, box.y + 290);
		await page.mouse.up();
		await page.waitForTimeout(200);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(2); // Should select only top 2 shapes

		// Test 3: Add bottom shapes with Shift+Drag
		await page.keyboard.down("Shift");
		await page.mouse.move(box.x + 150, box.y + 320);
		await page.mouse.down();
		await page.mouse.move(box.x + 480, box.y + 480);
		await page.mouse.up();
		await page.keyboard.up("Shift");
		await page.waitForTimeout(200);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(4); // Should now have all 4 shapes selected
	});

	test("should maintain proper selection state during operations", async ({ page }) => {
		// Create shapes
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create 3 shapes
		for (let i = 0; i < 3; i++) {
			await page.mouse.move(box.x + 150 + i * 120, box.y + 150);
			await page.mouse.down();
			await page.mouse.move(box.x + 220 + i * 120, box.y + 220);
			await page.mouse.up();
			await page.waitForTimeout(50);
		}

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Select all shapes
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		let selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(3);

		// Get shape IDs for tracking
		const shapeIds = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-selected="true"]'));
			return shapes.map((shape) => shape.getAttribute("data-shape-id"));
		});

		expect(shapeIds.length).toBe(3);
		expect(shapeIds.every((id) => id !== null)).toBe(true);

		// Move all selected shapes
		await page.mouse.move(box.x + 270, box.y + 185);
		await page.mouse.down();
		await page.mouse.move(box.x + 370, box.y + 285);
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Check that selection is maintained after move
		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(3);

		// Check that the same shapes are selected
		const shapeIdsAfterMove = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-selected="true"]'));
			return shapes.map((shape) => shape.getAttribute("data-shape-id"));
		});

		expect(shapeIdsAfterMove.sort()).toEqual(shapeIds.sort());

		// Deselect one shape with Shift+Click
		const firstShapeRect = await page.evaluate((id) => {
			const shape = document.querySelector(`[data-shape-id="${id}"]`);
			return shape ? shape.getBoundingClientRect() : null;
		}, shapeIds[0]);

		if (firstShapeRect) {
			await page.keyboard.down("Shift");
			await page.mouse.click(
				firstShapeRect.x + firstShapeRect.width / 2,
				firstShapeRect.y + firstShapeRect.height / 2,
			);
			await page.keyboard.up("Shift");
			await page.waitForTimeout(100);
		}

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(2);
	});

	test("should properly handle selection with overlapping shapes", async ({ page }) => {
		// Create overlapping shapes to test z-index selection
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create 3 overlapping rectangles
		for (let i = 0; i < 3; i++) {
			await page.mouse.move(box.x + 200 + i * 30, box.y + 200 + i * 30);
			await page.mouse.down();
			await page.mouse.move(box.x + 350 + i * 30, box.y + 350 + i * 30);
			await page.mouse.up();
			await page.waitForTimeout(100);
		}

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Click in overlap area - should select topmost shape only
		await page.mouse.click(box.x + 250, box.y + 250);
		await page.waitForTimeout(100);

		let selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(1);

		// Use drag selection to select all overlapping shapes
		await page.mouse.move(box.x + 180, box.y + 180);
		await page.mouse.down();
		await page.mouse.move(box.x + 450, box.y + 450);
		await page.mouse.up();
		await page.waitForTimeout(200);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(3);
	});

	test("should show proper visual feedback for multi-selection", async ({ page }) => {
		// Create shapes
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create 3 shapes
		for (let i = 0; i < 3; i++) {
			await page.mouse.move(box.x + 150 + i * 120, box.y + 150);
			await page.mouse.down();
			await page.mouse.move(box.x + 220 + i * 120, box.y + 220);
			await page.mouse.up();
			await page.waitForTimeout(50);
		}

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Select all shapes
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		// Check for selection indicators
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(3);

		// Check if selection box/indicator is visible
		// This depends on the implementation - adjust selector as needed
		const selectionIndicator = await page
			.locator('.selection-indicator, .selection-box, [data-selection="true"]')
			.count();
		expect(selectionIndicator).toBeGreaterThan(0);

		// Check that multiple selection is visually indicated
		// Look for any UI element that shows multiple items are selected
		const hasMultiSelectionUI = await page.evaluate(() => {
			// Check for any text indicating multiple selection
			const body = document.body.textContent || "";
			return (
				body.includes("selected") ||
				document.querySelector('[data-selected="true"]') !== null ||
				document.querySelector(".multi-selection") !== null
			);
		});

		expect(hasMultiSelectionUI).toBe(true);
	});

	test("should handle edge cases in multi-selection", async ({ page }) => {
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Test with no shapes - selection operations should not error
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Try select all with no shapes
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(100);

		let selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(0);

		// Try drag selection with no shapes
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 300);
		await page.mouse.up();
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(0);

		// Create a shape and test single shape operations
		await page.click('button:has-text("四角形")');
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Select the single shape
		await page.mouse.click(box.x + 250, box.y + 225);
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(1);

		// Shift+click the same shape should deselect it
		await page.keyboard.down("Shift");
		await page.mouse.click(box.x + 250, box.y + 225);
		await page.keyboard.up("Shift");
		await page.waitForTimeout(100);

		selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(0);
	});
});
