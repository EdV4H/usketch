import { expect, test } from "@playwright/test";

test.describe("Multi-Selection Drag", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should move multiple selected shapes together", async ({ page }) => {
		// Create three rectangles
		await page.click('button:has-text("Rectangle")');

		// Create first rectangle at (100, 100)
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Create second rectangle at (300, 100)
		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Create third rectangle at (200, 300)
		await page.mouse.move(200, 300);
		await page.mouse.down();
		await page.mouse.move(300, 400);
		await page.mouse.up();

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Select all shapes with Ctrl/Cmd+A
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);

		// Wait for selection to be applied
		await page.waitForTimeout(100);

		// Get initial positions of all shapes
		const initialPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					id: el.id || el.dataset.shapeId,
					left: translateMatch ? parseFloat(translateMatch[1]) : 0,
					top: translateMatch ? parseFloat(translateMatch[2]) : 0,
				};
			}),
		);

		expect(initialPositions.length).toBe(3);

		// Drag the selected shapes (click on first shape and drag)
		await page.mouse.move(150, 150); // Click inside first shape
		await page.mouse.down();
		await page.mouse.move(250, 250); // Move by (100, 100)
		await page.mouse.up();

		// Wait for movement to complete
		await page.waitForTimeout(100);

		// Get new positions
		const newPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					id: el.id || el.dataset.shapeId,
					left: translateMatch ? parseFloat(translateMatch[1]) : 0,
					top: translateMatch ? parseFloat(translateMatch[2]) : 0,
				};
			}),
		);

		// Verify all shapes moved by the same amount (100, 100)
		for (let i = 0; i < initialPositions.length; i++) {
			const initial = initialPositions[i];
			const final = newPositions.find((p) => p.id === initial.id);
			expect(final).toBeDefined();
			if (final) {
				// Allow small differences due to rounding
				expect(final.left - initial.left).toBeGreaterThanOrEqual(95);
				expect(final.left - initial.left).toBeLessThanOrEqual(105);
				expect(final.top - initial.top).toBeGreaterThanOrEqual(95);
				expect(final.top - initial.top).toBeLessThanOrEqual(105);
			}
		}
	});

	test("should move only selected shapes when dragging", async ({ page }) => {
		// Create three rectangles
		await page.click('button:has-text("Rectangle")');

		// Create rectangles
		const positions = [
			{ x: 100, y: 100 },
			{ x: 300, y: 100 },
			{ x: 200, y: 300 },
		];

		for (const pos of positions) {
			await page.mouse.move(pos.x, pos.y);
			await page.mouse.down();
			await page.mouse.move(pos.x + 100, pos.y + 100);
			await page.mouse.up();
		}

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Select first shape
		await page.click(".whiteboard-canvas", { position: { x: 150, y: 150 } });

		// Add second shape to selection with Shift+Click
		await page.keyboard.down("Shift");
		await page.click(".whiteboard-canvas", { position: { x: 350, y: 150 } });
		await page.keyboard.up("Shift");

		// Third shape remains unselected

		// Get initial positions
		const initialPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					id: el.id || el.dataset.shapeId,
					left: translateMatch ? parseFloat(translateMatch[1]) : 0,
					top: translateMatch ? parseFloat(translateMatch[2]) : 0,
					selected: el.dataset.selected === "true",
				};
			}),
		);

		// Drag the selected shapes
		await page.mouse.move(150, 150);
		await page.mouse.down();
		await page.mouse.move(250, 250); // Move by (100, 100)
		await page.mouse.up();

		await page.waitForTimeout(100);

		// Get new positions
		const newPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					id: el.id || el.dataset.shapeId,
					left: translateMatch ? parseFloat(translateMatch[1]) : 0,
					top: translateMatch ? parseFloat(translateMatch[2]) : 0,
				};
			}),
		);

		// Verify selected shapes moved, unselected didn't
		for (const initial of initialPositions) {
			const final = newPositions.find((p) => p.id === initial.id);
			expect(final).toBeDefined();
			if (final) {
				if (initial.selected) {
					// Selected shapes should move
					expect(final.left - initial.left).toBeGreaterThanOrEqual(95);
					expect(final.left - initial.left).toBeLessThanOrEqual(105);
					expect(final.top - initial.top).toBeGreaterThanOrEqual(95);
					expect(final.top - initial.top).toBeLessThanOrEqual(105);
				} else {
					// Unselected shapes should not move
					expect(final.left).toBe(initial.left);
					expect(final.top).toBe(initial.top);
				}
			}
		}
	});

	test("should maintain relative positions when moving multiple shapes", async ({ page }) => {
		// Create three rectangles in different positions
		await page.click('button:has-text("Rectangle")');

		const shapes = [
			{ x: 100, y: 100, width: 80, height: 80 },
			{ x: 300, y: 150, width: 80, height: 80 },
			{ x: 200, y: 300, width: 80, height: 80 },
		];

		for (const shape of shapes) {
			await page.mouse.move(shape.x, shape.y);
			await page.mouse.down();
			await page.mouse.move(shape.x + shape.width, shape.y + shape.height);
			await page.mouse.up();
		}

		// Select all shapes
		await page.click('button:has-text("Select")');
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);

		await page.waitForTimeout(100);

		// Get initial relative positions
		const initialPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					left: translateMatch ? parseFloat(translateMatch[1]) : 0,
					top: translateMatch ? parseFloat(translateMatch[2]) : 0,
				};
			}),
		);

		// Calculate initial relative distances
		const initialDistances = {
			shape0to1X: initialPositions[1].left - initialPositions[0].left,
			shape0to1Y: initialPositions[1].top - initialPositions[0].top,
			shape0to2X: initialPositions[2].left - initialPositions[0].left,
			shape0to2Y: initialPositions[2].top - initialPositions[0].top,
		};

		// Move all shapes
		await page.mouse.move(150, 150);
		await page.mouse.down();
		await page.mouse.move(350, 250);
		await page.mouse.up();

		await page.waitForTimeout(100);

		// Get new positions
		const newPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => ({
				left: parseInt(el.style.left || "0"),
				top: parseInt(el.style.top || "0"),
			})),
		);

		// Calculate new relative distances
		const newDistances = {
			shape0to1X: newPositions[1].left - newPositions[0].left,
			shape0to1Y: newPositions[1].top - newPositions[0].top,
			shape0to2X: newPositions[2].left - newPositions[0].left,
			shape0to2Y: newPositions[2].top - newPositions[0].top,
		};

		// Verify relative positions are maintained
		expect(newDistances.shape0to1X).toBe(initialDistances.shape0to1X);
		expect(newDistances.shape0to1Y).toBe(initialDistances.shape0to1Y);
		expect(newDistances.shape0to2X).toBe(initialDistances.shape0to2X);
		expect(newDistances.shape0to2Y).toBe(initialDistances.shape0to2Y);
	});

	test("should deselect when clicking empty space after multi-selection", async ({ page }) => {
		// Create two rectangles
		await page.click('button:has-text("Rectangle")');

		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Select all
		await page.click('button:has-text("Select")');
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);

		// Verify shapes are selected
		let selectedShapes = await page.$$('[data-selected="true"]');
		expect(selectedShapes.length).toBe(2);

		// Click on empty space
		await page.click(".whiteboard-canvas", { position: { x: 50, y: 50 } });

		// Verify shapes are deselected
		selectedShapes = await page.$$('[data-selected="true"]');
		expect(selectedShapes.length).toBe(0);
	});
});
