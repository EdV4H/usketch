// Global type definitions

import type { Shape } from "@usketch/shared-types";

declare global {
	interface Window {
		__lastCreatedShape?: Shape;
	}
}

// For Node.js environments
declare global {
	// Global variable requires var declaration
	var __lastCreatedShape: Shape | undefined;
}
