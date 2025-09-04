import { expect, test } from "@playwright/test";

test("freedraw complete test - draw, select, move, preview", async ({ page }) => {
	// Enable console logging
	page.on("console", (msg) => {
		if (msg.type() === "log") {
			console.log("Browser log:", msg.text());
		}
	});

	await page.goto("/?e2e=true");
	await page.waitForSelector(".whiteboard-canvas");

	const canvas = page.locator(".whiteboard-canvas");
	const box = await canvas.boundingBox();
	if (!box) throw new Error("Canvas not found");

	// Step 1: Test preview while drawing
	console.log("=== Step 1: Testing preview while drawing ===");
	await page.click('button:has-text("Draw")');
	await page.waitForTimeout(100);

	// Start drawing and check for preview
	await page.mouse.move(box.x + 100, box.y + 100);
	await page.mouse.down();

	// Move while drawing - should see preview
	await page.mouse.move(box.x + 150, box.y + 150, { steps: 3 });

	// Check for preview element
	const previewCount = await page.locator(".preview-layer > *").count();
	console.log(`Preview elements during draw: ${previewCount}`);

	// Complete the drawing
	await page.mouse.move(box.x + 200, box.y + 200, { steps: 3 });
	await page.mouse.up();
	await page.waitForTimeout(200);

	// Preview should be cleared after drawing
	const previewAfter = await page.locator(".preview-layer > *").count();
	console.log(`Preview elements after draw: ${previewAfter}`);
	expect(previewAfter).toBe(0);

	// Check if shape was created
	const shapes = await page.locator('[data-shape="true"]').count();
	console.log(`Shapes created: ${shapes}`);
	expect(shapes).toBe(1);

	// Get shape details including SVG path
	const shapeElement = page.locator('[data-shape="true"]').first();
	const shapeData = await shapeElement.evaluate((el) => {
		const svg = el.querySelector("svg");
		const path = svg?.querySelector("path");
		return {
			id: el.dataset.shapeId,
			transform: el.style.transform,
			svgPath: path?.getAttribute("d"),
			svgViewBox: svg?.getAttribute("viewBox"),
			width: el.style.width,
			height: el.style.height,
		};
	});
	console.log("Shape data:", shapeData);

	// Step 2: Select and move the shape
	console.log("=== Step 2: Selecting and moving shape ===");
	await page.click('button:has-text("Select")');
	await page.waitForTimeout(100);

	// Click to select
	await page.mouse.click(box.x + 150, box.y + 150);
	await page.waitForTimeout(200);

	// Verify selection
	const selectedCount = await page.locator('[data-selected="true"]').count();
	expect(selectedCount).toBe(1);

	// Move the shape
	await page.mouse.move(box.x + 150, box.y + 150);
	await page.mouse.down();
	await page.mouse.move(box.x + 250, box.y + 250, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(200);

	// Get moved shape data
	const movedShapeData = await shapeElement.evaluate((el) => {
		const svg = el.querySelector("svg");
		const path = svg?.querySelector("path");
		return {
			id: el.dataset.shapeId,
			transform: el.style.transform,
			svgPath: path?.getAttribute("d"),
			selected: el.dataset.selected,
		};
	});
	console.log("Moved shape data:", movedShapeData);

	// Verify movement
	expect(movedShapeData.transform).not.toBe(shapeData.transform);
	expect(movedShapeData.selected).toBe("true");

	// SVG path should remain the same (relative coordinates)
	console.log("Original path:", shapeData.svgPath);
	console.log("Moved path:", movedShapeData.svgPath);

	// The path should be relative to the shape, not absolute
	expect(movedShapeData.svgPath).toContain("M 0");
});
