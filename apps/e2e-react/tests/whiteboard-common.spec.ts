import { test } from "@playwright/test";
import { whiteboardTests } from "@whiteboard/e2e-tests";

test.describe("React Whiteboard - Common Tests", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
	});

	whiteboardTests();
});
