import { expect, test } from "@playwright/test";

test.describe("Drag Selection Indicator", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("http://localhost:5173");
		await page.waitForSelector(".whiteboard-canvas");
	});

	test("should show selection box indicator during drag", async ({ page }) => {
		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Start dragging from empty space
		await page.mouse.move(100, 100);
		await page.mouse.down();

		// Move mouse to create selection box
		await page.mouse.move(300, 300);

		// Wait a bit for DOM updates
		await page.waitForTimeout(100);

		// Check if selection box overlay exists and is visible
		const selectionBox = await page.$("#selection-box-overlay");
		expect(selectionBox).toBeTruthy();

		// Check visibility
		const isVisible = await page.evaluate(() => {
			const elem = document.getElementById("selection-box-overlay");
			if (!elem) return false;
			const style = window.getComputedStyle(elem);
			return style.display !== "none" && style.visibility !== "hidden";
		});
		expect(isVisible).toBe(true);

		// Check dimensions
		const dimensions = await page.evaluate(() => {
			const elem = document.getElementById("selection-box-overlay");
			if (!elem) return null;
			return {
				width: parseInt(elem.style.width || "0"),
				height: parseInt(elem.style.height || "0"),
			};
		});

		expect(dimensions).not.toBeNull();
		expect(dimensions!.width).toBeGreaterThan(0);
		expect(dimensions!.height).toBeGreaterThan(0);

		// Complete the drag
		await page.mouse.up();

		// Check that selection box is hidden after drag ends
		const isHiddenAfter = await page.evaluate(() => {
			const elem = document.getElementById("selection-box-overlay");
			if (!elem) return true;
			return window.getComputedStyle(elem).display === "none";
		});
		expect(isHiddenAfter).toBe(true);
	});

	test("should update selection box size as mouse moves", async ({ page }) => {
		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Start dragging
		await page.mouse.move(100, 100);
		await page.mouse.down();

		// Move to first position
		await page.mouse.move(200, 200);
		await page.waitForTimeout(50);

		const dimensions1 = await page.evaluate(() => {
			const elem = document.getElementById("selection-box-overlay");
			if (!elem) return null;
			return {
				width: parseInt(elem.style.width || "0"),
				height: parseInt(elem.style.height || "0"),
			};
		});

		// Move to larger area
		await page.mouse.move(400, 400);
		await page.waitForTimeout(50);

		const dimensions2 = await page.evaluate(() => {
			const elem = document.getElementById("selection-box-overlay");
			if (!elem) return null;
			return {
				width: parseInt(elem.style.width || "0"),
				height: parseInt(elem.style.height || "0"),
			};
		});

		// Dimensions should have increased
		expect(dimensions2!.width).toBeGreaterThan(dimensions1!.width);
		expect(dimensions2!.height).toBeGreaterThan(dimensions1!.height);

		await page.mouse.up();
	});
});
