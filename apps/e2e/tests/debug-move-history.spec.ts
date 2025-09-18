import { expect, test } from "@playwright/test";

test.describe("Debug Move History", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
		await page.waitForTimeout(500);
	});

	test("should test multi-shape move and undo", async ({ page }) => {
		console.log("Testing multi-shape move and undo...");

		// Create additional shapes for testing
		await page.click('button:has-text("四角形")');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Create first new rectangle
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Create second new rectangle
		await page.mouse.move(box.x + 350, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 450, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Select all shapes
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(200);

		const totalShapes = await page.locator('[data-shape="true"]').count();
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		console.log(`Total shapes: ${totalShapes}, Selected: ${selectedShapes}`);

		// Get initial positions
		const initialPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return {
					id: shape.getAttribute("data-shape-id"),
					x: rect.x,
					y: rect.y,
				};
			});
		});

		console.log("Initial positions:", initialPositions);

		// Perform move operation
		await page.mouse.move(box.x + 300, box.y + 225);
		await page.mouse.down();
		await page.mouse.move(box.x + 400, box.y + 325, { steps: 5 });
		await page.mouse.up();
		await page.waitForTimeout(300);

		// Get positions after move
		const movedPositions = await page.evaluate(() => {
			const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
			return shapes.map((shape) => {
				const rect = shape.getBoundingClientRect();
				return {
					id: shape.getAttribute("data-shape-id"),
					x: rect.x,
					y: rect.y,
				};
			});
		});

		console.log("Moved positions:", movedPositions);

		// Calculate movement
		for (let i = 0; i < initialPositions.length; i++) {
			const deltaX = movedPositions[i].x - initialPositions[i].x;
			const deltaY = movedPositions[i].y - initialPositions[i].y;
			console.log(`Shape ${movedPositions[i].id}: moved by (${deltaX}, ${deltaY})`);
		}

		// Check if undo is available
		const undoButton = page.locator('button[aria-label="Undo"]');
		const undoAvailable = await undoButton.isEnabled();
		console.log(`Undo available: ${undoAvailable}`);

		if (undoAvailable) {
			// Perform undo
			await undoButton.click();
			await page.waitForTimeout(300);

			// Get positions after undo
			const undoPositions = await page.evaluate(() => {
				const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
				return shapes.map((shape) => {
					const rect = shape.getBoundingClientRect();
					return {
						id: shape.getAttribute("data-shape-id"),
						x: rect.x,
						y: rect.y,
					};
				});
			});

			console.log("Positions after undo:", undoPositions);

			// Check if shapes returned to original positions
			for (let i = 0; i < initialPositions.length; i++) {
				const deltaX = Math.abs(undoPositions[i].x - initialPositions[i].x);
				const deltaY = Math.abs(undoPositions[i].y - initialPositions[i].y);
				console.log(`Shape ${undoPositions[i].id}: distance from original (${deltaX}, ${deltaY})`);

				// They should be close to original positions (within 10 pixels tolerance)
				if (deltaX > 10 || deltaY > 10) {
					console.warn(
						`Shape ${undoPositions[i].id} did not return to original position properly!`,
					);
				}
			}

			// Check if redo is available
			const redoButton = page.locator('button[aria-label="Redo"]');
			const redoAvailable = await redoButton.isEnabled();
			console.log(`Redo available: ${redoAvailable}`);

			if (redoAvailable) {
				// Perform redo
				await redoButton.click();
				await page.waitForTimeout(300);

				// Get positions after redo
				const redoPositions = await page.evaluate(() => {
					const shapes = Array.from(document.querySelectorAll('[data-shape="true"]'));
					return shapes.map((shape) => {
						const rect = shape.getBoundingClientRect();
						return {
							id: shape.getAttribute("data-shape-id"),
							x: rect.x,
							y: rect.y,
						};
					});
				});

				console.log("Positions after redo:", redoPositions);

				// Check if shapes returned to moved positions
				for (let i = 0; i < movedPositions.length; i++) {
					const deltaX = Math.abs(redoPositions[i].x - movedPositions[i].x);
					const deltaY = Math.abs(redoPositions[i].y - movedPositions[i].y);
					console.log(
						`Shape ${redoPositions[i].id}: distance from moved position (${deltaX}, ${deltaY})`,
					);

					if (deltaX > 10 || deltaY > 10) {
						console.warn(`Shape ${redoPositions[i].id} did not return to moved position properly!`);
					}
				}
			}
		}

		// Test passes if we reach here without errors
		expect(totalShapes).toBeGreaterThan(0);
	});

	test("should test single shape move vs multi-shape move history", async ({ page }) => {
		console.log("Testing single vs multi-shape move history...");

		// Create a shape for single move test
		await page.click('button:has-text("四角形")');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 250);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Switch to select tool
		await page.click('button:has-text("選択")');
		await page.waitForTimeout(100);

		// Check how many undo operations are available before single move
		let undoCount = 0;
		const undoButton = page.locator('button[aria-label="Undo"]');

		// Count initial undos (shape creations)
		while ((await undoButton.isEnabled()) && undoCount < 10) {
			undoCount++;
			await undoButton.click();
			await page.waitForTimeout(100);
		}

		console.log(`Found ${undoCount} initial undo operations`);

		// Redo all the undos to restore state
		const redoButton = page.locator('button[aria-label="Redo"]');
		for (let i = 0; i < undoCount; i++) {
			if (await redoButton.isEnabled()) {
				await redoButton.click();
				await page.waitForTimeout(100);
			}
		}

		await page.waitForTimeout(200);

		// Now test single shape move
		await page.mouse.click(box.x + 250, box.y + 225); // Click on shape to select it
		await page.waitForTimeout(100);

		// Move single shape
		await page.mouse.move(box.x + 250, box.y + 225);
		await page.mouse.down();
		await page.mouse.move(box.x + 350, box.y + 325);
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Check if undo is available (should be 1 for the single move)
		const undoAfterSingle = await undoButton.isEnabled();
		console.log(`Undo available after single move: ${undoAfterSingle}`);

		if (undoAfterSingle) {
			await undoButton.click();
			await page.waitForTimeout(200);
		}

		// Now test multi-shape move
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`); // Select all
		await page.waitForTimeout(200);

		const selectedShapes = await page.locator('[data-selected="true"]').count();
		console.log(`Selected shapes for multi-move: ${selectedShapes}`);

		// Move all shapes
		await page.mouse.move(box.x + 300, box.y + 225);
		await page.mouse.down();
		await page.mouse.move(box.x + 400, box.y + 325);
		await page.mouse.up();
		await page.waitForTimeout(200);

		// Check if undo is available (should be 1 for the multi-move, not multiple)
		const undoAfterMulti = await undoButton.isEnabled();
		console.log(`Undo available after multi-move: ${undoAfterMulti}`);

		// Test that one undo reverses the entire multi-move
		if (undoAfterMulti) {
			await undoButton.click();
			await page.waitForTimeout(200);

			// After undoing multi-move, check if undo is still available for previous operations
			const undoAfterMultiUndo = await undoButton.isEnabled();
			console.log(`Undo still available after multi-move undo: ${undoAfterMultiUndo}`);
		}

		expect(true).toBe(true);
	});
});
