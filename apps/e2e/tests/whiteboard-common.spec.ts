import { test } from "@playwright/test";
import { whiteboardTests } from "@usketch/e2e-tests";

test.describe("Whiteboard - Common Tests", () => {
	test.beforeEach(async ({ page }) => {
		// Add ?e2e=true to skip demo shapes during tests
		await page.goto("/?e2e=true");
	});

	whiteboardTests();
});
