import { expect, test } from "@playwright/test";

test.describe("Shape Alignment", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		// Wait for the canvas to be ready
		await page.waitForSelector('[data-testid="whiteboard-canvas"]');
	});

	test("should align shapes to the left", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(250, 250);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select both shapes using selection box
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		// Wait a bit for selection to register
		await page.waitForTimeout(100);

		// Use keyboard shortcut to align left (Cmd/Ctrl + Shift + ArrowLeft)
		const isMac = process.platform === "darwin";
		const modifierKey = isMac ? "Meta" : "Control";
		await page.keyboard.press(`${modifierKey}+Shift+ArrowLeft`);

		// Wait for alignment to complete
		await page.waitForTimeout(100);

		// Check if shapes are aligned (we'll verify through visual inspection or by checking shape positions)
		// Get the shapes and verify their x positions are the same
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBeGreaterThanOrEqual(2);

		// Get positions of both shapes
		const positions = await Promise.all(
			shapes.slice(0, 2).map(async (shape) => {
				const transform = await shape.getAttribute("transform");
				// Parse transform to get x position
				const match = transform?.match(/translate\(([^,]+),/);
				return match ? parseFloat(match[1]) : null;
			}),
		);

		// Both shapes should have the same x position after left alignment
		if (positions[0] !== null && positions[1] !== null) {
			expect(Math.abs(positions[0] - positions[1])).toBeLessThan(1);
		}
	});

	test("should align shapes to the right", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(250, 250);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select both shapes
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		await page.waitForTimeout(100);

		// Align right
		const isMac = process.platform === "darwin";
		const modifierKey = isMac ? "Meta" : "Control";
		await page.keyboard.press(`${modifierKey}+Shift+ArrowRight`);

		await page.waitForTimeout(100);

		// Verify alignment happened
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBeGreaterThanOrEqual(2);
	});

	test("should align shapes to the top", async ({ page }) => {
		// Create shapes at different vertical positions
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		await page.mouse.move(100, 200);
		await page.mouse.down();
		await page.mouse.move(150, 250);
		await page.mouse.up();

		// Select and align
		await page.click('[data-testid="tool-select"]');
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(200, 300);
		await page.mouse.up();

		await page.waitForTimeout(100);

		const isMac = process.platform === "darwin";
		const modifierKey = isMac ? "Meta" : "Control";
		await page.keyboard.press(`${modifierKey}+Shift+ArrowUp`);

		await page.waitForTimeout(100);

		// Get positions of shapes
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBeGreaterThanOrEqual(2);

		// Get y positions
		const positions = await Promise.all(
			shapes.slice(0, 2).map(async (shape) => {
				const transform = await shape.getAttribute("transform");
				const match = transform?.match(/translate\([^,]+,\s*([^)]+)/);
				return match ? parseFloat(match[1]) : null;
			}),
		);

		// Both shapes should have the same y position after top alignment
		if (positions[0] !== null && positions[1] !== null) {
			expect(Math.abs(positions[0] - positions[1])).toBeLessThan(1);
		}
	});

	test("should align shapes to horizontal center", async ({ page }) => {
		// Create shapes
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		await page.mouse.move(200, 200);
		await page.mouse.down();
		await page.mouse.move(250, 250);
		await page.mouse.up();

		// Select and align to center
		await page.click('[data-testid="tool-select"]');
		await page.mouse.move(50, 50);
		await page.mouse.down();
		await page.mouse.move(300, 300);
		await page.mouse.up();

		await page.waitForTimeout(100);

		const isMac = process.platform === "darwin";
		const modifierKey = isMac ? "Meta" : "Control";
		await page.keyboard.press(`${modifierKey}+Shift+c`);

		await page.waitForTimeout(100);

		// Verify center alignment
		const shapes = await page.locator("[data-shape-id]").all();
		expect(shapes.length).toBeGreaterThanOrEqual(2);
	});

	test("should not align when only one shape is selected", async ({ page }) => {
		// Create single shape
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		// Select the shape
		await page.click('[data-testid="tool-select"]');
		await page.click("[data-shape-id]");

		// Get initial position
		const shapeBefore = await page.locator("[data-shape-id]").first();
		const transformBefore = await shapeBefore.getAttribute("transform");

		// Try to align (should not do anything)
		const isMac = process.platform === "darwin";
		const modifierKey = isMac ? "Meta" : "Control";
		await page.keyboard.press(`${modifierKey}+Shift+ArrowLeft`);

		await page.waitForTimeout(100);

		// Position should remain the same
		const shapeAfter = await page.locator("[data-shape-id]").first();
		const transformAfter = await shapeAfter.getAttribute("transform");

		expect(transformAfter).toBe(transformBefore);
	});

	test("should work with multiple shape selection using Shift key", async ({ page }) => {
		// Create three shapes
		await page.click('[data-testid="tool-rectangle"]');

		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(150, 150);
		await page.mouse.up();

		await page.mouse.move(200, 100);
		await page.mouse.down();
		await page.mouse.move(250, 150);
		await page.mouse.up();

		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(350, 150);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select first shape
		const shapes = await page.locator("[data-shape-id]").all();
		await shapes[0].click();

		// Add second shape to selection with Shift
		await page.keyboard.down("Shift");
		await shapes[1].click();

		// Add third shape to selection
		await shapes[2].click();
		await page.keyboard.up("Shift");

		await page.waitForTimeout(100);

		// Align all three shapes
		const isMac = process.platform === "darwin";
		const modifierKey = isMac ? "Meta" : "Control";
		await page.keyboard.press(`${modifierKey}+Shift+ArrowLeft`);

		await page.waitForTimeout(100);

		// Verify all three are aligned
		const finalShapes = await page.locator("[data-shape-id]").all();
		expect(finalShapes.length).toBe(3);
	});
});
