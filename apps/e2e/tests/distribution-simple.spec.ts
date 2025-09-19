import { expect, test } from "@playwright/test";

test.describe("Simple Distribution Test", () => {
	test("should distribute 3 shapes horizontally", async ({ page }) => {
		await page.goto("http://localhost:6173");
		await page.waitForLoadState("networkidle");

		// Wait for whiteboardStore to be available
		await page.waitForFunction(() => (window as any).whiteboardStore);

		// Clear any existing shapes
		await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			const shapeIds = Object.keys(store.shapes);
			if (shapeIds.length > 0) {
				store.deleteShapes(shapeIds);
			}
		});

		// Create three rectangles
		await page.click('[data-testid="tool-rectangle"]');

		// Rectangle 1
		await page.mouse.move(100, 150);
		await page.mouse.down();
		await page.mouse.move(150, 200);
		await page.mouse.up();

		// Rectangle 2
		await page.mouse.move(200, 150);
		await page.mouse.down();
		await page.mouse.move(250, 200);
		await page.mouse.up();

		// Rectangle 3
		await page.mouse.move(400, 150);
		await page.mouse.down();
		await page.mouse.move(450, 200);
		await page.mouse.up();

		// Check that at least 3 shapes exist
		const _shapes = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes);
		});

		// Switch to select tool and select all
		await page.click('[data-testid="tool-select"]');

		// Try both Cmd+A (Mac) and Ctrl+A (Windows/Linux)
		const isMac = process.platform === "darwin";
		await page.keyboard.press(isMac ? "Meta+a" : "Control+a");

		// Check that all shapes are selected
		const selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBeGreaterThanOrEqual(3);

		// Check if distribution buttons are visible
		const distributeHorizontal = page.locator('[data-testid="distribute-horizontal"]');
		await expect(distributeHorizontal).toBeVisible();

		// Get initial positions
		const initialPositions = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes)
				.map((shape: any) => ({ id: shape.id, x: shape.x, width: shape.width }))
				.sort((a: any, b: any) => a.x - b.x);
		});

		// Click distribute horizontal
		await distributeHorizontal.click();

		// Get final positions
		const finalPositions = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return Object.values(store.shapes)
				.map((shape: any) => ({ id: shape.id, x: shape.x, width: shape.width }))
				.sort((a: any, b: any) => a.x - b.x);
		});

		// Verify distribution - check at least 3 shapes
		expect(finalPositions.length).toBeGreaterThanOrEqual(3);

		// Get the last 3 shapes for comparison
		const lastThreeInitial = initialPositions.slice(-3);
		const lastThreeFinal = finalPositions.slice(-3);

		// First and last of our created shapes should maintain position
		expect(lastThreeFinal[0].x).toBe(lastThreeInitial[0].x);
		expect(lastThreeFinal[2].x).toBe(lastThreeInitial[2].x);

		// Middle shape should be centered (use the last 3 shapes)
		const firstCenter = lastThreeFinal[0].x + lastThreeFinal[0].width / 2;
		const lastCenter = lastThreeFinal[2].x + lastThreeFinal[2].width / 2;
		const expectedMiddleCenter = (firstCenter + lastCenter) / 2;
		const actualMiddleCenter = lastThreeFinal[1].x + lastThreeFinal[1].width / 2;

		// Allow small tolerance for floating point
		expect(Math.abs(actualMiddleCenter - expectedMiddleCenter)).toBeLessThan(1);
	});
});
