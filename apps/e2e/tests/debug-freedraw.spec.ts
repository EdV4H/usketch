import { expect, test } from "@playwright/test";

test("debug freedraw rendering and selection", async ({ page }) => {
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

	// Get shape details
	const shapeElement = page.locator('[data-shape="true"]').first();
	const shapeData = await shapeElement.evaluate((el) => {
		const rect = el.getBoundingClientRect();
		return {
			id: el.dataset.shapeId,
			type: el.dataset.shapeType,
			selected: el.dataset.selected,
			rect: {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
			},
			style: {
				left: el.style.left,
				top: el.style.top,
				width: el.style.width,
				height: el.style.height,
				transform: el.style.transform,
			},
		};
	});
	console.log("Shape data:", JSON.stringify(shapeData, null, 2));

	// Step 2: Switch to select tool
	console.log("=== Step 2: Switching to select tool ===");
	await page.click('button:has-text("Select")');
	await page.waitForTimeout(100);

	// Step 3: Try to select the shape
	console.log("=== Step 3: Trying to select shape ===");
	// Click in the middle of the drawn line
	const clickX = box.x + 150;
	const clickY = box.y + 150;
	console.log(`Clicking at (${clickX}, ${clickY})`);
	await page.mouse.click(clickX, clickY);
	await page.waitForTimeout(200);

	// Check selection
	const selectedCount = await page.locator('[data-selected="true"]').count();
	console.log(`Selected shapes: ${selectedCount}`);

	// Get updated shape data
	const updatedShapeData = await shapeElement.evaluate((el) => {
		return {
			selected: el.dataset.selected,
			classList: Array.from(el.classList),
		};
	});
	console.log("Updated shape data:", JSON.stringify(updatedShapeData, null, 2));

	expect(selectedCount).toBe(1);
});
