import { test } from "@playwright/test";
import { whiteboardTests } from "@usketch/e2e-tests";

test.describe("Whiteboard - Vanilla Version", () => {
	test.beforeEach(async ({ page }) => {
		// Test Vanilla version with ?vanilla=true&e2e=true
		await page.goto("/?vanilla=true&e2e=true");
	});

	whiteboardTests();
});
