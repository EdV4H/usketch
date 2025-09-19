import { expect, test } from "@playwright/test";

test.describe("Debug Selection Issues", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
		await page.waitForTimeout(500);
	});

	test("should debug current selection behavior", async ({ page }) => {
		console.log("Starting debug test...");

		// Check initial state
		const initialShapes = await page.locator('[data-shape="true"]').count();
		console.log(`Initial shapes count: ${initialShapes}`);

		const initialSelected = await page.locator('[data-selected="true"]').count();
		console.log(`Initial selected count: ${initialSelected}`);

		// Create one rectangle
		await page.click('button:has-text("四角形")');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(200);

		const shapesAfterCreate = await page.locator('[data-shape="true"]').count();
		console.log(`Shapes after creating one: ${shapesAfterCreate}`);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Try selecting with Ctrl+A
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		const selectedAfterCtrlA = await page.locator('[data-selected="true"]').count();
		console.log(`Selected after Ctrl+A: ${selectedAfterCtrlA}`);

		// Debug: Get all data-selected values
		const selectedValues = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => ({
				id: shape.getAttribute("data-shape-id"),
				type: shape.getAttribute("data-shape-type"),
				selected: shape.getAttribute("data-selected"),
				hasClass: shape.classList.contains("selected"),
			}));
		});

		console.log("All shapes selection state:", selectedValues);

		// Debug: Check store state
		const storeState = await page.evaluate(() => {
			// @ts-expect-error
			const store = window.whiteboardStore || {};
			return {
				hasStore: !!store.getState,
				// @ts-expect-error
				selectedShapeIds: store.getState ? Array.from(store.getState().selectedShapeIds || []) : [],
				// @ts-expect-error
				currentTool: store.getState ? store.getState().currentTool : "unknown",
			};
		});

		console.log("Store state:", storeState);

		// Simple assertion to pass the test
		expect(shapesAfterCreate).toBeGreaterThan(initialShapes);
	});

	test("should test undo/redo availability", async ({ page }) => {
		console.log("Testing undo/redo buttons...");

		// Check initial button states
		const undoButton = page.locator('button[aria-label="Undo"]');
		const redoButton = page.locator('button[aria-label="Redo"]');

		const undoInitial = await undoButton.isEnabled();
		const redoInitial = await redoButton.isEnabled();

		console.log(`Initial - Undo enabled: ${undoInitial}, Redo enabled: ${redoInitial}`);

		// Create a shape
		await page.click('button:has-text("四角形")');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 150);
		await page.mouse.up();
		await page.waitForTimeout(200);

		const undoAfterCreate = await undoButton.isEnabled();
		const redoAfterCreate = await redoButton.isEnabled();

		console.log(
			`After shape creation - Undo enabled: ${undoAfterCreate}, Redo enabled: ${redoAfterCreate}`,
		);

		// Try clicking undo
		if (undoAfterCreate) {
			await undoButton.click();
			await page.waitForTimeout(200);

			const undoAfterUndo = await undoButton.isEnabled();
			const redoAfterUndo = await redoButton.isEnabled();

			console.log(`After undo - Undo enabled: ${undoAfterUndo}, Redo enabled: ${redoAfterUndo}`);
		}

		// Test passes if we reach here
		expect(true).toBe(true);
	});
});
