import { expect, test } from "@playwright/test";

test.describe("Background Switcher", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5174/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should have background selector in toolbar", async ({ page }) => {
		// Check that the background selector exists
		const selector = page.locator('[data-testid="background-selector"]');
		await expect(selector).toBeVisible();

		// Check that default value is "grid"
		const value = await selector.inputValue();
		expect(value).toBe("grid");

		// Check available options
		const options = await selector.locator("option").allTextContents();
		expect(options).toEqual(["None", "Grid", "Dots", "Lines", "Isometric"]);
	});

	test("should switch between different backgrounds", async ({ page }) => {
		const selector = page.locator('[data-testid="background-selector"]');
		const backgroundLayer = page.locator(".background-layer");

		// Initial state: Grid background
		await expect(selector).toHaveValue("grid");
		let backgroundStyle = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundImage,
		);
		expect(backgroundStyle).toContain("linear-gradient");

		// Switch to None background
		await selector.selectOption("none");
		await expect(selector).toHaveValue("none");
		backgroundStyle = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundImage,
		);
		expect(backgroundStyle).toBe("none");

		// Switch to Dots background
		await selector.selectOption("dots");
		await expect(selector).toHaveValue("dots");
		backgroundStyle = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundImage,
		);
		// Dots renderer uses SVG data URL
		expect(backgroundStyle).toContain("data:image/svg+xml");

		// Switch to Lines background
		await selector.selectOption("lines");
		await expect(selector).toHaveValue("lines");
		backgroundStyle = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundImage,
		);
		expect(backgroundStyle).toContain("linear-gradient");

		// Switch to Isometric background
		await selector.selectOption("isometric");
		await expect(selector).toHaveValue("isometric");
		// Isometric renderer also uses SVG data URL
		backgroundStyle = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundImage,
		);
		expect(backgroundStyle).toContain("data:image/svg+xml");

		// Switch back to Grid
		await selector.selectOption("grid");
		await expect(selector).toHaveValue("grid");
		backgroundStyle = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundImage,
		);
		expect(backgroundStyle).toContain("linear-gradient");
	});

	test("should maintain background when drawing shapes", async ({ page }) => {
		const selector = page.locator('[data-testid="background-selector"]');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Switch to dots background
		await selector.selectOption("dots");

		// Draw a rectangle
		await page.click('[data-testid="tool-rectangle"]');
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.up();

		// Verify shape was created
		const shapes = await page.locator('[data-shape="true"]').count();
		expect(shapes).toBe(1);

		// Verify background is still dots
		await expect(selector).toHaveValue("dots");
		const backgroundStyle = await page
			.locator(".background-layer")
			.evaluate((el) => window.getComputedStyle(el).backgroundImage);
		// Dots renderer uses SVG data URL
		expect(backgroundStyle).toContain("data:image/svg+xml");
	});

	test("should maintain background during canvas interaction", async ({ page }) => {
		const selector = page.locator('[data-testid="background-selector"]');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Set dots background
		await selector.selectOption("dots");
		await expect(selector).toHaveValue("dots");

		// Pan the canvas (Alt + drag)
		await page.keyboard.down("Alt");
		await page.mouse.move(box.x + 200, box.y + 200);
		await page.mouse.down();
		await page.mouse.move(box.x + 300, box.y + 300);
		await page.mouse.up();
		await page.keyboard.up("Alt");

		// Background type should still be dots after panning
		await expect(selector).toHaveValue("dots");
		const backgroundStyle = await page
			.locator(".background-layer")
			.evaluate((el) => window.getComputedStyle(el).backgroundImage);
		expect(backgroundStyle).toContain("data:image/svg+xml");
	});

	test("should update background when zooming", async ({ page }) => {
		const selector = page.locator('[data-testid="background-selector"]');
		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Ensure grid background is selected
		await selector.selectOption("grid");

		// Get initial background size
		const backgroundLayer = page.locator(".background-layer");
		const initialSize = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundSize,
		);

		// Zoom in
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.wheel(0, -100);

		// Wait a moment for the zoom to apply
		await page.waitForTimeout(100);

		// Check that background size has changed (zoomed)
		const newSize = await backgroundLayer.evaluate(
			(el) => window.getComputedStyle(el).backgroundSize,
		);
		expect(newSize).not.toBe(initialSize);

		// The numeric value should be larger (zoomed in)
		const initialSizeNum = Number.parseFloat(initialSize);
		const newSizeNum = Number.parseFloat(newSize);
		expect(newSizeNum).toBeGreaterThan(initialSizeNum);
	});
});
