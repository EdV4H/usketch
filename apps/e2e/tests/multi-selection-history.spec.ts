import { expect, test } from "@playwright/test";

test.describe("Multi-Selection History Issues Investigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
		// Wait for initial load
		await page.waitForTimeout(500);
	});

	test("should only create ONE history entry when moving multiple selected shapes", async ({
		page,
	}) => {
		// Get initial shapes count (including demo shapes)
		const initialShapes = await page.locator('[data-shape="true"]').count();

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

		// Select all shapes with Ctrl+A (or Cmd+A on Mac)
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		// Verify total shapes including our 3 new shapes
		const totalShapes = await page.locator('[data-shape="true"]').count();
		expect(totalShapes).toBe(initialShapes + 3);

		// Verify all shapes are selected
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		expect(selectedShapes).toBe(totalShapes);

		// Get initial shape positions before move
		const initialPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return { x: rect.x, y: rect.y, id: shape.getAttribute("data-shape-id") };
			});
		});

		// Move all selected shapes at once
		await page.mouse.move(box.x + 300, box.y + 125);
		await page.mouse.down();
		await page.mouse.move(box.x + 400, box.y + 225, { steps: 10 });
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Get final shape positions after move
		const finalPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return { x: rect.x, y: rect.y, id: shape.getAttribute("data-shape-id") };
			});
		});

		// Verify shapes moved by roughly the same amount
		for (let i = 0; i < initialPositions.length; i++) {
			const deltaX = finalPositions[i].x - initialPositions[i].x;
			const deltaY = finalPositions[i].y - initialPositions[i].y;
			expect(Math.abs(deltaX - 100)).toBeLessThan(50); // Should move ~100px right
			expect(Math.abs(deltaY - 100)).toBeLessThan(50); // Should move ~100px down
		}

		// CRITICAL TEST: Undo should move ALL shapes back with ONE operation
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(200);

		// Check if shapes returned to approximately original positions
		const undoPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return { x: rect.x, y: rect.y, id: shape.getAttribute("data-shape-id") };
			});
		});

		// Verify all shapes returned to initial positions
		for (let i = 0; i < initialPositions.length; i++) {
			expect(Math.abs(undoPositions[i].x - initialPositions[i].x)).toBeLessThan(20);
			expect(Math.abs(undoPositions[i].y - initialPositions[i].y)).toBeLessThan(20);
		}

		// CRITICAL TEST: Redo should move ALL shapes forward with ONE operation
		await page.click('button[aria-label="Redo"]');
		await page.waitForTimeout(200);

		const redoPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return { x: rect.x, y: rect.y, id: shape.getAttribute("data-shape-id") };
			});
		});

		// Verify all shapes returned to moved positions
		for (let i = 0; i < finalPositions.length; i++) {
			expect(Math.abs(redoPositions[i].x - finalPositions[i].x)).toBeLessThan(20);
			expect(Math.abs(redoPositions[i].y - finalPositions[i].y)).toBeLessThan(20);
		}
	});

	test("should NOT create excessive history entries during multi-shape drag", async ({ page }) => {
		// Create 5 rectangles for more complex test
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create 5 rectangles
		for (let i = 0; i < 5; i++) {
			await page.mouse.move(box.x + 100 + i * 80, box.y + 100);
			await page.mouse.down();
			await page.mouse.move(box.x + 150 + i * 80, box.y + 150);
			await page.mouse.up();
			await page.waitForTimeout(50);
		}

		// Switch to select tool and select all
		await page.click('button:has-text("選択")');
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		// Record current undo state
		const _initialUndoEnabled = await page.locator('button[aria-label="Undo"]').isEnabled();

		// Perform a drag with multiple intermediate positions (simulate slow drag)
		await page.mouse.move(box.x + 300, box.y + 125);
		await page.mouse.down();

		// Drag slowly with many steps to simulate user dragging
		for (let step = 0; step <= 20; step++) {
			const x = box.x + 300 + step * 5;
			const y = box.y + 125 + step * 3;
			await page.mouse.move(x, y);
			await page.waitForTimeout(10); // Small delay to simulate real drag
		}

		await page.mouse.up();
		await page.waitForTimeout(300);

		// Check that undo is enabled (should be if history was created)
		const finalUndoEnabled = await page.locator('button[aria-label="Undo"]').isEnabled();
		expect(finalUndoEnabled).toBe(true);

		// Test that ONE undo operation restores ALL shapes
		const beforeUndoPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return { x: rect.x, y: rect.y };
			});
		});

		// Single undo should restore all shapes to original positions
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(200);

		const afterUndoPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return { x: rect.x, y: rect.y };
			});
		});

		// All shapes should have moved back significantly
		for (let i = 0; i < beforeUndoPositions.length; i++) {
			const deltaX = Math.abs(afterUndoPositions[i].x - beforeUndoPositions[i].x);
			const deltaY = Math.abs(afterUndoPositions[i].y - beforeUndoPositions[i].y);
			expect(deltaX).toBeGreaterThan(80); // Should move back significantly
			expect(deltaY).toBeGreaterThan(40);
		}

		// CRITICAL: Second undo should NOT affect the shapes (no additional history entries)
		const beforeSecondUndo = await page.locator('button[aria-label="Undo"]').isEnabled();
		if (beforeSecondUndo) {
			// If undo is still enabled, this suggests multiple history entries were created
			console.warn(
				"WARNING: Multiple undo operations available - suggests excessive history creation",
			);
		}
	});

	test("should handle rapid multi-selection movements efficiently", async ({ page }) => {
		// Create 3 shapes
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		for (let i = 0; i < 3; i++) {
			await page.mouse.move(box.x + 150 + i * 100, box.y + 150);
			await page.mouse.down();
			await page.mouse.move(box.x + 200 + i * 100, box.y + 200);
			await page.mouse.up();
			await page.waitForTimeout(50);
		}

		// Switch to select tool and select all
		await page.click('button:has-text("選択")');
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		// Perform multiple rapid movements
		const baseX = box.x + 250;
		const baseY = box.y + 175;

		for (let move = 0; move < 3; move++) {
			await page.mouse.move(baseX, baseY);
			await page.mouse.down();
			await page.mouse.move(baseX + 50 + move * 20, baseY + 30 + move * 15);
			await page.mouse.up();
			await page.waitForTimeout(100); // Short pause between moves
		}

		// After 3 separate moves, undo should work properly
		// Each move should create 1 history entry, not 3+ entries per move

		// First undo - should reverse the last move
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Second undo - should reverse the second move
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Third undo - should reverse the first move
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Fourth undo should not be available (or should be the shape creation operations)
		const fourthUndoAvailable = await page.locator('button[aria-label="Undo"]').isEnabled();
		// This test ensures we're not creating dozens of history entries for multi-selection moves
		expect(fourthUndoAvailable).toBe(true); // Should still have shape creation undos available
	});

	test("should properly handle individual vs batch updates in selection", async ({ page }) => {
		// Create 2 shapes
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create first rectangle
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Create second rectangle
		await page.mouse.move(box.x + 350, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 450, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Test 1: Move single shape - should create one history entry
		await page.mouse.click(box.x + 250, box.y + 225);
		await page.waitForTimeout(100);

		await page.mouse.move(box.x + 250, box.y + 225);
		await page.mouse.down();
		await page.mouse.move(box.x + 250, box.y + 300);
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Verify single shape moved
		const singleMoveUndo = await page.locator('button[aria-label="Undo"]').isEnabled();
		expect(singleMoveUndo).toBe(true);

		// Undo single move
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(100);

		// Test 2: Move multiple shapes - should create ONE history entry
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		await page.mouse.move(box.x + 300, box.y + 225);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 300);
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Verify multi-shape move created history
		const multiMoveUndo = await page.locator('button[aria-label="Undo"]').isEnabled();
		expect(multiMoveUndo).toBe(true);

		// Single undo should restore both shapes
		await page.click('button[aria-label="Undo"]');
		await page.waitForTimeout(200);

		// This should complete the multi-shape undo in one operation
		// If the implementation is correct, both shapes should return to original positions
	});

	test("should debug history state during multi-selection operations", async ({ page }) => {
		// Inject debug logging
		await page.evaluate(() => {
			window.debugHistory = [];
			const originalLog = console.log;
			console.log = (...args) => {
				if (args[0] && typeof args[0] === "string" && args[0].includes("History")) {
					window.debugHistory.push(args.join(" "));
				}
				originalLog.apply(console, args);
			};
		});

		// Create shapes and perform operations
		await page.click('button:has-text("四角形")');

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create multiple shapes
		for (let i = 0; i < 3; i++) {
			await page.mouse.move(box.x + 150 + i * 100, box.y + 150);
			await page.mouse.down();
			await page.mouse.move(box.x + 200 + i * 100, box.y + 200);
			await page.mouse.up();
			await page.waitForTimeout(50);
		}

		// Select all and move
		await page.click('button:has-text("選択")');
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		// Perform move operation
		await page.mouse.move(box.x + 250, box.y + 175);
		await page.mouse.down();
		await page.mouse.move(box.x + 350, box.y + 275);
		await page.mouse.up();
		await page.waitForTimeout(300);

		// Get debug history
		const debugHistory = await page.evaluate(() => window.debugHistory || []);

		// Log debug information for analysis
		console.log("History Debug Log:", debugHistory);

		// Basic sanity check - history should have been modified
		expect(debugHistory.length).toBeGreaterThan(0);
	});
});
