import { expect, test } from "@playwright/test";

test.describe("Shape Distribution", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:6173");
		await page.waitForLoadState("networkidle");

		// Clear any existing shapes to ensure clean state
		await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			const shapeIds = Object.keys(store.shapes);
			if (shapeIds.length > 0) {
				store.deleteShapes(shapeIds);
			}
		});
	});

	test("should show distribution buttons when 3+ shapes are selected", async ({ page }) => {
		// Create three rectangles
		await page.click('[data-testid="tool-rectangle"]');

		// Rectangle 1
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Rectangle 2
		await page.mouse.move(250, 120);
		await page.mouse.down();
		await page.mouse.move(350, 220);
		await page.mouse.up();

		// Rectangle 3
		await page.mouse.move(400, 90);
		await page.mouse.down();
		await page.mouse.move(500, 190);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select all shapes with drag selection
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(550, 250);
		await page.mouse.up();

		// Distribution buttons should be visible
		const distributeHorizontal = page.locator('[data-testid="distribute-horizontal"]');
		const distributeVertical = page.locator('[data-testid="distribute-vertical"]');

		await expect(distributeHorizontal).toBeVisible();
		await expect(distributeVertical).toBeVisible();
	});

	test("should not show distribution buttons when less than 3 shapes are selected", async ({
		page,
	}) => {
		// Create two rectangles
		await page.click('[data-testid="tool-rectangle"]');

		// Rectangle 1
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Rectangle 2
		await page.mouse.move(250, 100);
		await page.mouse.down();
		await page.mouse.move(350, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select both shapes
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(400, 250);
		await page.mouse.up();

		// Distribution buttons should not be visible
		const distributeHorizontal = page.locator('[data-testid="distribute-horizontal"]');
		const distributeVertical = page.locator('[data-testid="distribute-vertical"]');

		await expect(distributeHorizontal).not.toBeVisible();
		await expect(distributeVertical).not.toBeVisible();
	});

	test("should distribute shapes horizontally with equal spacing", async ({ page }) => {
		// Create four rectangles at irregular intervals
		await page.click('[data-testid="tool-rectangle"]');

		// Rectangle 1 (leftmost)
		await page.mouse.move(100, 150);
		await page.mouse.down();
		await page.mouse.move(150, 200);
		await page.mouse.up();

		// Rectangle 2 (irregular position)
		await page.mouse.move(180, 150);
		await page.mouse.down();
		await page.mouse.move(230, 200);
		await page.mouse.up();

		// Rectangle 3 (irregular position)
		await page.mouse.move(320, 150);
		await page.mouse.down();
		await page.mouse.move(370, 200);
		await page.mouse.up();

		// Rectangle 4 (rightmost)
		await page.mouse.move(450, 150);
		await page.mouse.down();
		await page.mouse.move(500, 200);
		await page.mouse.up();

		// Switch to select tool and select all
		await page.click('[data-testid="tool-select"]');
		await page.mouse.move(50, 100);
		await page.mouse.down();
		await page.mouse.move(550, 250);
		await page.mouse.up();

		// Click distribute horizontal
		await page.click('[data-testid="distribute-horizontal"]');

		// Get shape positions
		const shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes)
				.map((shape: any) => ({ x: shape.x, width: shape.width }))
				.sort((a: any, b: any) => a.x - b.x);
		});

		// Calculate expected spacing
		expect(shapes.length).toBe(4);

		// Check that middle shapes are evenly spaced
		const firstCenter = shapes[0].x + shapes[0].width / 2;
		const lastCenter = shapes[3].x + shapes[3].width / 2;
		const expectedSpacing = (lastCenter - firstCenter) / 3;

		// Check second shape position
		const secondCenter = shapes[1].x + shapes[1].width / 2;
		const expectedSecondCenter = firstCenter + expectedSpacing;
		expect(Math.abs(secondCenter - expectedSecondCenter)).toBeLessThan(2);

		// Check third shape position
		const thirdCenter = shapes[2].x + shapes[2].width / 2;
		const expectedThirdCenter = firstCenter + expectedSpacing * 2;
		expect(Math.abs(thirdCenter - expectedThirdCenter)).toBeLessThan(2);
	});

	test("should distribute shapes vertically with equal spacing", async ({ page }) => {
		// Create four rectangles at irregular vertical intervals
		await page.click('[data-testid="tool-rectangle"]');

		// Rectangle 1 (topmost)
		await page.mouse.move(200, 100);
		await page.mouse.down();
		await page.mouse.move(250, 150);
		await page.mouse.up();

		// Rectangle 2 (irregular position)
		await page.mouse.move(200, 170);
		await page.mouse.down();
		await page.mouse.move(250, 220);
		await page.mouse.up();

		// Rectangle 3 (irregular position)
		await page.mouse.move(200, 280);
		await page.mouse.down();
		await page.mouse.move(250, 330);
		await page.mouse.up();

		// Rectangle 4 (bottommost)
		await page.mouse.move(200, 400);
		await page.mouse.down();
		await page.mouse.move(250, 450);
		await page.mouse.up();

		// Switch to select tool and select all
		await page.click('[data-testid="tool-select"]');
		await page.mouse.move(150, 50);
		await page.mouse.down();
		await page.mouse.move(300, 500);
		await page.mouse.up();

		// Click distribute vertical
		await page.click('[data-testid="distribute-vertical"]');

		// Get shape positions
		const shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes)
				.map((shape: any) => ({ y: shape.y, height: shape.height }))
				.sort((a: any, b: any) => a.y - b.y);
		});

		// Calculate expected spacing
		expect(shapes.length).toBe(4);

		// Check that middle shapes are evenly spaced
		const firstCenter = shapes[0].y + shapes[0].height / 2;
		const lastCenter = shapes[3].y + shapes[3].height / 2;
		const expectedSpacing = (lastCenter - firstCenter) / 3;

		// Check second shape position
		const secondCenter = shapes[1].y + shapes[1].height / 2;
		const expectedSecondCenter = firstCenter + expectedSpacing;
		expect(Math.abs(secondCenter - expectedSecondCenter)).toBeLessThan(2);

		// Check third shape position
		const thirdCenter = shapes[2].y + shapes[2].height / 2;
		const expectedThirdCenter = firstCenter + expectedSpacing * 2;
		expect(Math.abs(thirdCenter - expectedThirdCenter)).toBeLessThan(2);
	});

	test("should maintain first and last shape positions during distribution", async ({ page }) => {
		// Create three rectangles
		await page.click('[data-testid="tool-rectangle"]');

		// Rectangle 1 (will stay in place)
		await page.mouse.move(100, 200);
		await page.mouse.down();
		await page.mouse.move(150, 250);
		await page.mouse.up();

		// Rectangle 2 (will be repositioned)
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(250, 250);
		await page.mouse.up();

		// Rectangle 3 (will stay in place)
		await page.mouse.move(400, 200);
		await page.mouse.down();
		await page.mouse.move(450, 250);
		await page.mouse.up();

		// Get initial positions
		await page.click('[data-testid="tool-select"]');
		await page.mouse.move(50, 150);
		await page.mouse.down();
		await page.mouse.move(500, 300);
		await page.mouse.up();

		const initialPositions = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes)
				.map((shape: any) => ({ x: shape.x, y: shape.y }))
				.sort((a: any, b: any) => a.x - b.x);
		});

		// Distribute horizontally
		await page.click('[data-testid="distribute-horizontal"]');

		const finalPositions = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes)
				.map((shape: any) => ({ x: shape.x, y: shape.y }))
				.sort((a: any, b: any) => a.x - b.x);
		});

		// First and last shapes should not move
		expect(finalPositions[0].x).toBe(initialPositions[0].x);
		expect(finalPositions[0].y).toBe(initialPositions[0].y);
		expect(finalPositions[2].x).toBe(initialPositions[2].x);
		expect(finalPositions[2].y).toBe(initialPositions[2].y);

		// Middle shape should be centered between them
		const expectedMiddleX = (finalPositions[0].x + finalPositions[2].x) / 2;
		expect(Math.abs(finalPositions[1].x - expectedMiddleX)).toBeLessThan(2);
	});
});
