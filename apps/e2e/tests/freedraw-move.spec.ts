import { expect, test } from "@playwright/test";

test("freedraw shape movement", async ({ page }) => {
	// Enable console logging
	page.on("console", (msg) => {
		if (msg.type() === "log") {
			console.log("Browser log:", msg.text());
		}
	});

	await page.goto("http://localhost:3002/?e2e=true");
	await page.waitForSelector(".whiteboard-canvas");

	const canvas = page.locator(".whiteboard-canvas");
	const box = await canvas.boundingBox();
	if (!box) throw new Error("Canvas not found");

	// Step 1: Draw a freedraw shape
	console.log("=== Step 1: Drawing freedraw shape ===");
	await page.click('button:has-text("Draw")');
	await page.waitForTimeout(100);

	// Draw a simple line
	await page.mouse.move(box.x + 100, box.y + 100);
	await page.mouse.down();
	await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(200);

	// Check if shape was created
	const shapes = await page.locator('[data-shape="true"]').count();
	console.log(`Shapes created: ${shapes}`);
	expect(shapes).toBe(1);

	// Get initial position
	const shapeElement = page.locator('[data-shape="true"]').first();
	const initialData = await shapeElement.evaluate((el) => {
		const rect = el.getBoundingClientRect();
		return {
			id: el.dataset.shapeId,
			x: rect.x,
			y: rect.y,
			transform: el.style.transform,
		};
	});
	console.log("Initial position:", initialData);

	// Step 2: Switch to select tool
	console.log("=== Step 2: Switching to select tool ===");
	await page.click('button:has-text("Select")');
	await page.waitForTimeout(100);

	// Step 3: Select the shape
	console.log("=== Step 3: Selecting shape ===");
	const clickX = box.x + 150;
	const clickY = box.y + 150;
	await page.mouse.click(clickX, clickY);
	await page.waitForTimeout(200);

	// Verify selection
	const selectedCount = await page.locator('[data-selected="true"]').count();
	expect(selectedCount).toBe(1);

	// Step 4: Move the shape
	console.log("=== Step 4: Moving shape ===");
	// Drag from center of shape to new position
	await page.mouse.move(box.x + 150, box.y + 150);
	await page.mouse.down();
	await page.mouse.move(box.x + 250, box.y + 250, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(200);

	// Get final position
	const finalData = await shapeElement.evaluate((el) => {
		const rect = el.getBoundingClientRect();
		return {
			id: el.dataset.shapeId,
			x: rect.x,
			y: rect.y,
			transform: el.style.transform,
		};
	});
	console.log("Final position:", finalData);

	// Verify movement (should be approximately 100px to the right and down)
	expect(finalData.x).toBeGreaterThan(initialData.x + 50);
	expect(finalData.y).toBeGreaterThan(initialData.y + 50);

	// Check that transform has changed
	expect(finalData.transform).not.toBe(initialData.transform);
});
