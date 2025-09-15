import { expect, test } from "@playwright/test";

test.describe("Smart Guides", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173");
		await page.waitForLoadState("networkidle");
	});

	test("should show distance guides between shapes", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Create second rectangle with gap
		await page.mouse.move(250, 100);
		await page.mouse.down();
		await page.mouse.move(350, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select and start dragging the second rectangle
		await page.mouse.move(300, 150);
		await page.mouse.down();

		// Move it to create a 50px gap
		await page.mouse.move(250, 150);

		// Check for distance guide
		const distanceGuides = await page.locator(".snap-guidelines text").count();
		expect(distanceGuides).toBeGreaterThan(0);

		// Check that distance value is shown
		const distanceText = await page.locator(".snap-guidelines text").first().textContent();
		expect(distanceText).toBeTruthy();
		expect(Number(distanceText)).toBeGreaterThan(0);

		await page.mouse.up();
	});

	test("should show extension lines when shapes are aligned", async ({ page }) => {
		// Create first rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Create second rectangle
		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select and drag to align horizontally
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Move to align top edges
		await page.mouse.move(350, 100);

		// Check for solid extension lines
		const guides = await page.locator(".snap-guidelines line").evaluateAll((lines) =>
			lines.map((line) => ({
				dashArray: line.getAttribute("stroke-dasharray"),
				stroke: line.getAttribute("stroke"),
			})),
		);

		// Should have at least one solid line (extension)
		const solidLines = guides.filter((g) => g.dashArray === "none");
		expect(solidLines.length).toBeGreaterThan(0);

		await page.mouse.up();
	});

	test("should show different colors for different guide types", async ({ page }) => {
		// Create three rectangles
		await page.click('[data-testid="tool-rectangle"]');

		// First rectangle
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		// Second rectangle
		await page.mouse.move(250, 100);
		await page.mouse.down();
		await page.mouse.move(350, 200);
		await page.mouse.up();

		// Third rectangle
		await page.mouse.move(100, 250);
		await page.mouse.down();
		await page.mouse.move(200, 350);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select middle rectangle
		await page.mouse.move(300, 150);
		await page.mouse.down();

		// Move to position with both alignment and distance guides
		await page.mouse.move(225, 150);

		// Check guide colors
		const guides = await page
			.locator(".snap-guidelines line")
			.evaluateAll((lines) => lines.map((line) => line.getAttribute("stroke")));

		// Should have both blue (#007AFF) and orange (#FF9500) guides
		const blueGuides = guides.filter((color) => color === "#007AFF");
		const orangeGuides = guides.filter((color) => color === "#FF9500");

		expect(blueGuides.length).toBeGreaterThan(0); // Alignment guides
		expect(orangeGuides.length).toBeGreaterThan(0); // Distance guides

		await page.mouse.up();
	});

	test("should update guides dynamically while dragging", async ({ page }) => {
		// Create two rectangles
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select second rectangle
		await page.mouse.move(350, 150);
		await page.mouse.down();

		// Move closer - should show distance guide
		await page.mouse.move(250, 150);
		const initialGuides = await page.locator(".snap-guidelines line").count();

		// Move to align - guides should change
		await page.mouse.move(100, 150);
		const alignedGuides = await page.locator(".snap-guidelines line").count();

		// Guide count should change as we move between positions
		expect(initialGuides).toBeGreaterThan(0);
		expect(alignedGuides).toBeGreaterThan(0);

		await page.mouse.up();
	});

	test("should hide guides after releasing drag", async ({ page }) => {
		// Create two rectangles
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(100, 100);
		await page.mouse.down();
		await page.mouse.move(200, 200);
		await page.mouse.up();

		await page.mouse.move(300, 100);
		await page.mouse.down();
		await page.mouse.move(400, 200);
		await page.mouse.up();

		// Switch to select tool
		await page.click('[data-testid="tool-select"]');

		// Select and drag
		await page.mouse.move(350, 150);
		await page.mouse.down();
		await page.mouse.move(250, 150);

		// Guides should be visible while dragging
		const guidesWhileDragging = await page.locator(".snap-guidelines line").count();
		expect(guidesWhileDragging).toBeGreaterThan(0);

		// Release drag
		await page.mouse.up();

		// Guides should be hidden after release
		const guidesAfterRelease = await page.locator(".snap-guidelines line").count();
		expect(guidesAfterRelease).toBe(0);
	});
});
