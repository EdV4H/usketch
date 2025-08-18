import { test } from "@playwright/test";

test("simple draw test", async ({ page }) => {
	// Enable console logging
	page.on("console", (msg) => {
		console.log("Browser:", msg.text());
	});

	await page.goto("http://localhost:3002/?e2e=true");
	await page.waitForSelector(".whiteboard-canvas");

	const canvas = page.locator(".whiteboard-canvas");
	const box = await canvas.boundingBox();
	if (!box) throw new Error("Canvas not found");

	// Draw a freedraw shape
	await page.click('button:has-text("Draw")');

	// Draw from (100, 100) to (200, 200)
	console.log("Drawing from (100, 100) to (200, 200)");
	await page.mouse.move(box.x + 100, box.y + 100);
	await page.mouse.down();
	await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
	await page.mouse.up();

	await page.waitForTimeout(500);
});
