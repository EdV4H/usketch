import { test } from "@playwright/test";
import { layerPanelTests } from "@usketch/e2e-tests";

test.describe("Layer Panel", () => {
	test.beforeEach(async ({ page }) => {
		// Add ?e2e=true to skip demo shapes during tests
		await page.goto("/?e2e=true");

		// Open layer panel if collapsed
		const collapsed = await page.locator(".layer-panel--collapsed").count();
		if (collapsed > 0) {
			await page.locator(".layer-panel__toggle").click();
			await page.waitForTimeout(100);
		}
	});

	layerPanelTests();
});
