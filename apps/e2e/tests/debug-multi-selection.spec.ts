import { expect, test } from "@playwright/test";

test.describe("Debug Multi-Selection", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should verify rectangle creation works", async ({ page }) => {
		// Switch to Rectangle tool
		await page.click('button:has-text("Rectangle")');

		// Wait for tool to be ready
		await page.waitForTimeout(100);

		// Create first rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Wait for shape creation
		await page.waitForTimeout(200);

		// Check if shape was created
		const shapes = await page.$$('[data-shape="true"]');
		console.log("Number of shapes created:", shapes.length);

		// Get shape details
		const shapeDetails = await page.$$eval('[data-shape="true"]', (elements) =>
			elements.map((el) => ({
				id: el.id,
				type: el.dataset.shapeType,
				left: el.style.left,
				top: el.style.top,
				transform: el.style.transform,
			})),
		);
		console.log("Shape details:", shapeDetails);

		expect(shapes.length).toBe(1);

		// Create second rectangle
		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		await page.waitForTimeout(200);

		const shapesAfter = await page.$$('[data-shape="true"]');
		expect(shapesAfter.length).toBe(2);
	});

	test("should verify selection works", async ({ page }) => {
		// Create rectangles first
		await page.click('button:has-text("Rectangle")');

		// Create 3 rectangles
		const positions = [
			{ start: { x: 100, y: 100 }, end: { x: 200, y: 200 } },
			{ start: { x: 300, y: 100 }, end: { x: 400, y: 200 } },
			{ start: { x: 200, y: 300 }, end: { x: 300, y: 400 } },
		];

		for (const pos of positions) {
			await page.mouse.move(pos.start.x, pos.start.y);
			await page.mouse.down();
			await page.mouse.move(pos.end.x, pos.end.y);
			await page.mouse.up();
			await page.waitForTimeout(100);
		}

		// Verify all 3 shapes were created
		const shapesCreated = await page.$$('[data-shape="true"]');
		expect(shapesCreated.length).toBe(3);

		// Switch to Select tool
		await page.click('button:has-text("Select")');
		await page.waitForTimeout(100);

		// Select all with Ctrl/Cmd+A
		const modifier = process.platform === "darwin" ? "Meta" : "Control";
		await page.keyboard.press(`${modifier}+a`);

		await page.waitForTimeout(200);

		// Check selected shapes
		const selectedShapes = await page.$$('[data-selected="true"]');
		console.log("Selected shapes count:", selectedShapes.length);
		expect(selectedShapes.length).toBe(3);
	});
});
