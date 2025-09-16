import { expect, test } from "@playwright/test";

test.describe("Shift+Click Multi-Selection", () => {
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

	test("should add to selection with Shift+Click", async ({ page }) => {
		// Create three rectangles
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

		// Rectangle 3
		await page.mouse.move(400, 100);
		await page.mouse.down();
		await page.mouse.move(500, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Click first rectangle to select it
		await page.click('[data-testid="shape-layer"]', { position: { x: 150, y: 150 } });

		// Verify only one shape is selected
		let selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBe(1);

		// Shift+Click second rectangle to add to selection
		await page.click('[data-testid="shape-layer"]', {
			position: { x: 300, y: 150 },
			modifiers: ["Shift"],
		});

		// Verify two shapes are selected
		selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBe(2);

		// Shift+Click third rectangle to add to selection
		await page.click('[data-testid="shape-layer"]', {
			position: { x: 450, y: 150 },
			modifiers: ["Shift"],
		});

		// Verify three shapes are selected
		selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBe(3);
	});

	test("should toggle selection with Shift+Click on selected shape", async ({ page }) => {
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

		// Click first rectangle to select it
		await page.click('[data-testid="shape-layer"]', { position: { x: 150, y: 150 } });

		// Shift+Click second rectangle to add to selection
		await page.click('[data-testid="shape-layer"]', {
			position: { x: 300, y: 150 },
			modifiers: ["Shift"],
		});

		// Verify two shapes are selected
		let selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBe(2);

		// Shift+Click first rectangle again to deselect it
		await page.click('[data-testid="shape-layer"]', {
			position: { x: 150, y: 150 },
			modifiers: ["Shift"],
		});

		// Verify only one shape is selected
		selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBe(1);
	});

	test("should replace selection without Shift key", async ({ page }) => {
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

		// Click first rectangle to select it
		await page.click('[data-testid="shape-layer"]', { position: { x: 150, y: 150 } });

		// Click second rectangle WITHOUT Shift to replace selection
		await page.click('[data-testid="shape-layer"]', { position: { x: 300, y: 150 } });

		// Verify only one shape is selected
		const selectedCount = await page.evaluate(() => {
			const store = (window as any).whiteboardStore.getState();
			return store.selectedShapeIds.size;
		});
		expect(selectedCount).toBe(1);
	});
});
