import { test } from "@playwright/test";
import { whiteboardTests } from "@usketch/e2e-tests";

test.describe("Vanilla Whiteboard - Common Tests", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	whiteboardTests();
});
