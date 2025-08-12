import type { FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
	console.log("🎭 Global setup: Preparing E2E test environment");

	// Set environment variables for all workers
	process.env.TEST_PARALLEL_INDEX = "0";

	// You can perform global setup tasks here:
	// - Start external services
	// - Seed test database
	// - Create test users
	// - Generate test data

	console.log(`📍 Base URL: ${config.projects[0].use?.baseURL}`);
	console.log(`🔧 Workers: ${config.workers}`);
	console.log(`🔁 Retries: ${config.projects[0].retries}`);

	// Return a teardown function
	return async () => {
		console.log("🧹 Global teardown: Cleaning up");
	};
}

export default globalSetup;
