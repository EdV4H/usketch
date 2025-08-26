import { expect, test } from "@playwright/test";

test.describe("Simple Multi-Selection Drag Test", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should verify multi-selection drag works", async ({ page }) => {
		// Create two rectangles
		await page.click('button:has-text("Rectangle")');

		// Create first rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Create second rectangle
		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();
		await page.waitForTimeout(100);

		// Verify shapes were created
		const shapes = await page.$$('[data-shape="true"]');
		expect(shapes.length).toBe(2);

		// Switch to Select tool
		await page.click('button:has-text("Select")');
		await page.waitForTimeout(100);

		// Select all shapes with Ctrl/Cmd+A
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);
		await page.waitForTimeout(100);

		// Verify selection
		const selectedShapes = await page.$$('[data-selected="true"]');
		expect(selectedShapes.length).toBe(2);

		// Get initial positions
		const initialPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					id: el.dataset.shapeId || el.id,
					x: translateMatch ? parseFloat(translateMatch[1]) : 0,
					y: translateMatch ? parseFloat(translateMatch[2]) : 0,
				};
			}),
		);

		console.log("Initial positions:", initialPositions);

		// Drag the selected shapes - click on first shape and drag
		await page.mouse.move(150, 150); // Click inside first shape
		await page.mouse.down();
		await page.mouse.move(250, 250); // Move by (100, 100)
		await page.mouse.up();

		// Wait for movement
		await page.waitForTimeout(200);

		// Get new positions
		const newPositions = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => {
				const transform = el.style.transform || "";
				const translateMatch = transform.match(
					/translate\((\d+(?:\.\d+)?)px,\s*(\d+(?:\.\d+)?)px\)/,
				);
				return {
					id: el.dataset.shapeId || el.id,
					x: translateMatch ? parseFloat(translateMatch[1]) : 0,
					y: translateMatch ? parseFloat(translateMatch[2]) : 0,
				};
			}),
		);

		console.log("New positions:", newPositions);

		// Check that both shapes moved
		for (let i = 0; i < initialPositions.length; i++) {
			const deltaX = newPositions[i].x - initialPositions[i].x;
			const deltaY = newPositions[i].y - initialPositions[i].y;
			console.log(`Shape ${i}: deltaX=${deltaX}, deltaY=${deltaY}`);

			// Both shapes should move by approximately 100px
			expect(Math.abs(deltaX - 100)).toBeLessThan(10);
			expect(Math.abs(deltaY - 100)).toBeLessThan(10);
		}
	});
});
