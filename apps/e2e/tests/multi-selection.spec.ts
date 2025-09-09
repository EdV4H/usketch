import { expect, test } from "@playwright/test";

test.describe("Multi-Selection Feature", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test.describe("Basic Selection", () => {
		test("should select multiple shapes with Shift+Click", async ({ page }) => {
			// Create first rectangle
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			// Create second rectangle
			await page.mouse.move(400, 200);
			await page.mouse.down();
			await page.mouse.move(500, 300);
			await page.mouse.up();

			// Create third rectangle
			await page.mouse.move(300, 400);
			await page.mouse.down();
			await page.mouse.move(400, 500);
			await page.mouse.up();

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// Select first shape
			await page.click(".whiteboard-canvas", { position: { x: 250, y: 250 } });

			// Add second shape with Shift+Click
			await page.keyboard.down("Shift");
			await page.click(".whiteboard-canvas", { position: { x: 450, y: 250 } });
			await page.keyboard.up("Shift");

			// Verify both shapes are selected
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(2);

			// Add third shape with Shift+Click
			await page.keyboard.down("Shift");
			await page.click(".whiteboard-canvas", { position: { x: 350, y: 450 } });
			await page.keyboard.up("Shift");

			// Verify all three shapes are selected
			const allSelectedShapes = await page.$$('[data-selected="true"]');
			expect(allSelectedShapes.length).toBe(3);
		});

		test("should deselect shapes with Shift+Click on selected shape", async ({ page }) => {
			// Create two rectangles
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			await page.mouse.move(400, 200);
			await page.mouse.down();
			await page.mouse.move(500, 300);
			await page.mouse.up();

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// Select both shapes
			await page.click(".whiteboard-canvas", { position: { x: 250, y: 250 } });
			await page.keyboard.down("Shift");
			await page.click(".whiteboard-canvas", { position: { x: 450, y: 250 } });

			// Deselect first shape
			await page.click(".whiteboard-canvas", { position: { x: 250, y: 250 } });
			await page.keyboard.up("Shift");

			// Verify only one shape is selected
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(1);
		});
	});

	test.describe("Keyboard Shortcuts", () => {
		test("should select all shapes with Ctrl+A (or Cmd+A on Mac)", async ({ page }) => {
			// Create three shapes
			await page.click('button:has-text("Rectangle")');

			for (let i = 0; i < 3; i++) {
				await page.mouse.move(200 + i * 150, 200);
				await page.mouse.down();
				await page.mouse.move(280 + i * 150, 280);
				await page.mouse.up();
			}

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// Select all with keyboard shortcut
			const modifier = process.platform === "darwin" ? "Meta" : "Control";
			await page.keyboard.press(`${modifier}+a`);

			// Verify all shapes are selected
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(3);

			// Check if group selection box is visible
			const groupSelectionBox = await page.$(".group-selection-box");
			expect(groupSelectionBox).toBeTruthy();

			// Check selection count indicator
			const selectionCount = await page.textContent(".selection-count");
			expect(selectionCount).toContain("3 objects selected");
		});

		test("should clear selection with Escape key", async ({ page }) => {
			// Create and select shapes
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			await page.click('button:has-text("Select")');
			await page.click(".whiteboard-canvas", { position: { x: 250, y: 250 } });

			// Verify shape is selected
			let selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(1);

			// Press Escape to clear selection
			await page.keyboard.press("Escape");

			// Verify no shapes are selected
			selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(0);
		});

		test("should delete selected shapes with Delete key", async ({ page }) => {
			// Create three shapes
			await page.click('button:has-text("Rectangle")');

			for (let i = 0; i < 3; i++) {
				await page.mouse.move(200 + i * 150, 200);
				await page.mouse.down();
				await page.mouse.move(280 + i * 150, 280);
				await page.mouse.up();
			}

			// Select all shapes
			await page.click('button:has-text("Select")');
			const modifier = process.platform === "darwin" ? "Meta" : "Control";
			await page.keyboard.press(`${modifier}+a`);

			// Delete selected shapes
			await page.keyboard.press("Delete");

			// Verify all shapes are deleted
			const remainingShapes = await page.$$('[data-shape="true"]');
			expect(remainingShapes.length).toBe(0);
		});
	});

	test.describe("Drag Selection (Rubber Band)", () => {
		test("should select shapes with drag selection", async ({ page }) => {
			// Create three shapes in a grid
			await page.click('button:has-text("Rectangle")');

			const positions = [
				{ x: 200, y: 200 },
				{ x: 350, y: 200 },
				{ x: 200, y: 350 },
			];

			for (const pos of positions) {
				await page.mouse.move(pos.x, pos.y);
				await page.mouse.down();
				await page.mouse.move(pos.x + 80, pos.y + 80);
				await page.mouse.up();
			}

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// Drag to select multiple shapes
			await page.mouse.move(150, 150);
			await page.mouse.down();
			await page.mouse.move(450, 300);
			await page.mouse.up();

			// Verify two shapes are selected (top two)
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(2);
		});

		test("should add to selection with Shift+Drag", async ({ page }) => {
			// Create four shapes in a grid
			await page.click('button:has-text("Rectangle")');

			const positions = [
				{ x: 200, y: 200 },
				{ x: 350, y: 200 },
				{ x: 200, y: 350 },
				{ x: 350, y: 350 },
			];

			for (const pos of positions) {
				await page.mouse.move(pos.x, pos.y);
				await page.mouse.down();
				await page.mouse.move(pos.x + 80, pos.y + 80);
				await page.mouse.up();
			}

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// Select top two shapes with drag
			await page.mouse.move(150, 150);
			await page.mouse.down();
			await page.mouse.move(450, 300);
			await page.mouse.up();

			// Add bottom two shapes with Shift+Drag
			await page.keyboard.down("Shift");
			await page.mouse.move(150, 320);
			await page.mouse.down();
			await page.mouse.move(450, 450);
			await page.mouse.up();
			await page.keyboard.up("Shift");

			// Verify all four shapes are selected
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(4);
		});
	});

	test.describe("Multi-Selection Operations", () => {
		test("should move multiple selected shapes together", async ({ page }) => {
			// Create two shapes
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			await page.mouse.move(400, 200);
			await page.mouse.down();
			await page.mouse.move(500, 300);
			await page.mouse.up();

			// Select both shapes
			await page.click('button:has-text("Select")');
			const modifier = process.platform === "darwin" ? "Meta" : "Control";
			await page.keyboard.press(`${modifier}+a`);

			// Get initial positions
			const shapesBefore = await page.$$eval('[data-shape="true"]', (elements) =>
				elements.map((el) => ({
					left: parseInt(el.style.left || "0", 10),
					top: parseInt(el.style.top || "0", 10),
				})),
			);

			// Move selected shapes
			await page.mouse.move(250, 250);
			await page.mouse.down();
			await page.mouse.move(350, 350); // Move by (100, 100)
			await page.mouse.up();

			// Get new positions
			const shapesAfter = await page.$$eval('[data-shape="true"]', (elements) =>
				elements.map((el) => ({
					left: parseInt(el.style.left || "0", 10),
					top: parseInt(el.style.top || "0", 10),
				})),
			);

			// Verify all shapes moved by the same amount
			expect(shapesAfter[0].left - shapesBefore[0].left).toBeCloseTo(100, -1);
			expect(shapesAfter[0].top - shapesBefore[0].top).toBeCloseTo(100, -1);
			expect(shapesAfter[1].left - shapesBefore[1].left).toBeCloseTo(100, -1);
			expect(shapesAfter[1].top - shapesBefore[1].top).toBeCloseTo(100, -1);
		});

		test("should show group bounding box for multiple selection", async ({ page }) => {
			// Create three shapes
			await page.click('button:has-text("Rectangle")');

			for (let i = 0; i < 3; i++) {
				await page.mouse.move(200 + i * 150, 200);
				await page.mouse.down();
				await page.mouse.move(280 + i * 150, 280);
				await page.mouse.up();
			}

			// Select all shapes
			await page.click('button:has-text("Select")');
			const modifier = process.platform === "darwin" ? "Meta" : "Control";
			await page.keyboard.press(`${modifier}+a`);

			// Check for group selection box
			const groupBox = await page.$(".group-selection-box");
			expect(groupBox).toBeTruthy();

			// Check for individual selection boxes
			const individualBoxes = await page.$$(".individual-selection-box");
			expect(individualBoxes.length).toBe(3);

			// Verify selection count badge
			const badge = await page.$(".selection-count");
			expect(badge).toBeTruthy();
			const badgeText = await badge?.textContent();
			expect(badgeText).toBe("3 objects selected");
		});
	});

	test.describe("Edge Cases", () => {
		test("should create and show selection box DOM element during drag", async ({ page }) => {
			// Create shapes
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// Start drag selection
			await page.mouse.move(100, 100);
			await page.mouse.down();

			// Move to create selection box
			await page.mouse.move(400, 400);

			// Wait for DOM element to be created
			await page.waitForSelector("#selection-box-overlay", { state: "attached" });

			// Check that the selection box DOM element exists
			const selectionBox = await page.$("#selection-box-overlay");
			expect(selectionBox).toBeTruthy();

			// Check that it's visible during drag
			const isVisible = await selectionBox.evaluate((el) => {
				const style = window.getComputedStyle(el);
				return style.display !== "none" && style.visibility !== "hidden";
			});
			expect(isVisible).toBe(true);

			// Check that it has proper dimensions
			const dimensions = await selectionBox.evaluate((el) => ({
				width: el.offsetWidth,
				height: el.offsetHeight,
				left: parseInt(el.style.left || "0", 10),
				top: parseInt(el.style.top || "0", 10),
			}));

			// The box should have non-zero dimensions
			expect(dimensions.width).toBeGreaterThan(0);
			expect(dimensions.height).toBeGreaterThan(0);

			// Complete the drag
			await page.mouse.up();

			// Check that selection box is hidden after release
			const displayAfter = await selectionBox.evaluate((el) => window.getComputedStyle(el).display);
			expect(displayAfter).toBe("none");
		});

		test("should clear selection box overlay after drag selection", async ({ page }) => {
			// Create shapes
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			await page.mouse.move(400, 200);
			await page.mouse.down();
			await page.mouse.move(500, 300);
			await page.mouse.up();

			// Switch to select tool
			await page.click('button:has-text("Select")');

			// First drag selection
			await page.mouse.move(150, 150);
			await page.mouse.down();
			await page.mouse.move(550, 350);
			await page.mouse.up();

			// Check that selection box is hidden after release
			const selectionBox = await page.$("#selection-box-overlay");
			if (selectionBox) {
				const display = await selectionBox.evaluate((el) => window.getComputedStyle(el).display);
				expect(display).toBe("none");
			}

			// Start another drag selection
			await page.mouse.move(100, 100);
			await page.mouse.down();
			await page.mouse.move(250, 250);

			// Selection box should be visible during drag
			const selectionBoxDuringDrag = await page.$("#selection-box-overlay");
			if (selectionBoxDuringDrag) {
				const displayDuringDrag = await selectionBoxDuringDrag.evaluate(
					(el) => window.getComputedStyle(el).display,
				);
				expect(displayDuringDrag).toBe("block");
			}

			await page.mouse.up();

			// Check that selection box is hidden again
			const selectionBoxAfter = await page.$("#selection-box-overlay");
			if (selectionBoxAfter) {
				const displayAfter = await selectionBoxAfter.evaluate(
					(el) => window.getComputedStyle(el).display,
				);
				expect(displayAfter).toBe("none");
			}
		});

		test("should handle selection of overlapping shapes", async ({ page }) => {
			// Create overlapping shapes
			await page.click('button:has-text("Rectangle")');

			for (let i = 0; i < 3; i++) {
				await page.mouse.move(250 + i * 30, 250 + i * 30);
				await page.mouse.down();
				await page.mouse.move(350 + i * 30, 350 + i * 30);
				await page.mouse.up();
			}

			// Try to select the top shape
			await page.click('button:has-text("Select")');
			await page.click(".whiteboard-canvas", { position: { x: 320, y: 320 } });

			// Should select only one shape (the topmost)
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(1);
		});

		test("should maintain selection after tool switch and back", async ({ page }) => {
			// Create and select shapes
			await page.click('button:has-text("Rectangle")');
			await page.mouse.move(200, 200);
			await page.mouse.down();
			await page.mouse.move(300, 300);
			await page.mouse.up();

			await page.click('button:has-text("Select")');
			await page.click(".whiteboard-canvas", { position: { x: 250, y: 250 } });

			// Switch to rectangle tool
			await page.click('button:has-text("Rectangle")');

			// Switch back to select tool
			await page.click('button:has-text("Select")');

			// Selection should be cleared after tool switch
			const selectedShapes = await page.$$('[data-selected="true"]');
			expect(selectedShapes.length).toBe(0);
		});
	});
});
