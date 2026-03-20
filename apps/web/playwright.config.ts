import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	timeout: 30000,
	retries: 1,
	use: {
		baseURL: "http://localhost:4578",
		headless: true,
	},
	webServer: {
		command: "pnpm dev",
		port: 4578,
		reuseExistingServer: true,
	},
});
