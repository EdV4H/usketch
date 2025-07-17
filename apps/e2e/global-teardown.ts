import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🎭 Global teardown: Finalizing E2E tests');
  
  // Perform cleanup tasks here:
  // - Stop external services
  // - Clean up test data
  // - Generate reports
  // - Upload artifacts
  
  if (process.env.CI) {
    console.log('📊 CI environment detected - preserving artifacts');
  }
}

export default globalTeardown;