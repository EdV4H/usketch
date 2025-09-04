import { expect, test } from "@playwright/test";

test("freedraw padding test - no clipping", async ({ page }) => {
	await page.goto("/?e2e=true");
	await page.waitForSelector(".whiteboard-canvas");

	const canvas = page.locator(".whiteboard-canvas");
	const box = await canvas.boundingBox();
	if (!box) throw new Error("Canvas not found");

	// Draw with different stroke widths
	console.log("=== Testing different stroke widths ===");
	await page.click('button:has-text("Draw")');
	await page.waitForTimeout(100);

	// Draw a simple line
	await page.mouse.move(box.x + 100, box.y + 100);
	await page.mouse.down();
	await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
	await page.mouse.up();
	await page.waitForTimeout(200);

	// Get shape details
	const shapeElement = page.locator('[data-shape="true"]').first();
	const shapeData = await shapeElement.evaluate((el) => {
		const svg = el.querySelector("svg");
		const path = svg?.querySelector("path");
		const rect = el.getBoundingClientRect();
		return {
			width: el.style.width,
			height: el.style.height,
			svgWidth: svg?.getAttribute("width"),
			svgHeight: svg?.getAttribute("height"),
			svgOverflow: svg ? window.getComputedStyle(svg).overflow : null,
			pathData: path?.getAttribute("d"),
			strokeWidth: path?.getAttribute("stroke-width"),
			// Check if stroke is visible at edges
			elementRect: {
				width: rect.width,
				height: rect.height,
			},
		};
	});

	console.log("Shape data:", shapeData);

	// SVG should have overflow visible to prevent clipping
	expect(shapeData.svgOverflow).toBe("visible");

	// Path should start near origin (with padding)
	expect(shapeData.pathData).toMatch(/^M \d+ \d+/);

	// Element should be large enough to contain stroke
	const strokeWidth = parseInt(shapeData.strokeWidth || "2");
	const expectedPadding = Math.ceil(strokeWidth / 2) * 2;

	console.log(`Stroke width: ${strokeWidth}, Expected padding: ${expectedPadding}`);

	// Width and height should include padding
	const widthNum = parseInt(shapeData.width);
	const heightNum = parseInt(shapeData.height);

	// Should be at least 100px (the drawn size) plus padding
	expect(widthNum).toBeGreaterThanOrEqual(100 + expectedPadding);
	expect(heightNum).toBeGreaterThanOrEqual(100 + expectedPadding);
});
