import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	timeout: 30 * 1000,
	reporter: "html",
	use: {
		baseURL: process.env.E2E_BASE_URL || "http://localhost:6173",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "cd ../whiteboard && pnpm dev:e2e",
		port: 6173,
		reuseExistingServer: !process.env.CI, // Don't reuse in CI
		timeout: 120 * 1000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
