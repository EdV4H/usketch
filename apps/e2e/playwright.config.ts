import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, ".env.test") });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	testDir: "./tests",

	/* Run tests in files in parallel */
	fullyParallel: true,

	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,

	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,

	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,

	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		["html", { outputFolder: "playwright-report", open: "never" }],
		["json", { outputFile: "test-results/results.json" }],
		["junit", { outputFile: "test-results/junit.xml" }],
		process.env.CI ? ["github"] : ["list"],
	],

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: process.env.WHITEBOARD_URL || "http://localhost:5173",

		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: "retain-on-failure",

		/* Screenshot only on failure */
		screenshot: "only-on-failure",

		/* Video recording */
		video: "retain-on-failure",

		/* Test timeout */
		actionTimeout: 10000,
		navigationTimeout: 30000,

		/* Viewport size */
		viewport: { width: 1280, height: 720 },

		/* Ignore HTTPS errors */
		ignoreHTTPSErrors: true,

		/* Enable test isolation */
		storageState: undefined,
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},

		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},

		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},

		/* Test against mobile viewports. */
		{
			name: "Mobile Chrome",
			use: { ...devices["Pixel 5"] },
			// Mobile tests are optional in CI
			...(process.env.CI ? { skipOn: "ci" } : {}),
		},
		{
			name: "Mobile Safari",
			use: { ...devices["iPhone 12"] },
			// Mobile tests are optional in CI
			...(process.env.CI ? { skipOn: "ci" } : {}),
		},
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		command: process.env.CI
			? "pnpm --filter whiteboard build && pnpm --filter whiteboard preview --port 5173"
			: "pnpm --filter whiteboard dev",
		url: "http://localhost:5173",
		timeout: 120 * 1000,
		reuseExistingServer: !process.env.CI,
		stdout: "pipe",
		stderr: "pipe",
		env: {
			// Ensure the whiteboard app knows it's being tested
			NODE_ENV: "test",
		},
	},

	/* Test output settings */
	outputDir: "test-results",

	/* Maximum time one test can run for */
	timeout: 30 * 1000,

	/* Global timeout for the whole test run */
	globalTimeout: 10 * 60 * 1000, // 10 minutes

	/* Global setup and teardown */
	globalSetup: "./global-setup.ts",
	globalTeardown: "./global-teardown.ts",
});
