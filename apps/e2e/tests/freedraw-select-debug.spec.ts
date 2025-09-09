import { expect, test } from "@playwright/test";

test.describe("FreeDraw Selection Debug", () => {
	test("debug freedraw selection", async ({ page }) => {
		// Enable console logging
		page.on("console", (msg) => console.log("Browser:", msg.text()));

		await page.goto("/?e2e=true");
		await page.waitForSelector(".whiteboard-canvas");

		const canvas = page.locator(".whiteboard-canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("Canvas not found");

		// Draw a freedraw shape
		await page.click('button:has-text("Draw")');

		console.log("Drawing line from 100,100 to 200,200");
		await page.mouse.move(box.x + 100, box.y + 100);
		await page.mouse.down();
		await page.mouse.move(box.x + 200, box.y + 200, { steps: 10 });
		await page.mouse.up();

		// Wait a bit
		await page.waitForTimeout(500);

		// Verify shape was created
		const shapes = await page.locator('[data-shape="true"]').count();
		console.log("Shapes created:", shapes);
		expect(shapes).toBe(1);

		// Get shape info
		const shapeElement = page.locator('[data-shape="true"]').first();
		const shapeId = await shapeElement.getAttribute("data-shape-id");
		const shapeType = await shapeElement.getAttribute("data-shape-type");
		console.log("Shape info:", { id: shapeId, type: shapeType });

		// Switch to select tool
		await page.click('button:has-text("Select")');

		// Try to click on the freedraw shape
		console.log("Clicking at 150,150 to select shape");
		await page.mouse.click(box.x + 150, box.y + 150);

		// Wait a bit for selection
		await page.waitForTimeout(500);

		// Check selection
		const selectedShapes = await page.locator('[data-selected="true"]').count();
		console.log("Selected shapes:", selectedShapes);

		// Get selected attribute value
		const selectedAttr = await shapeElement.getAttribute("data-selected");
		console.log("Shape selected attribute:", selectedAttr);
	});
});
