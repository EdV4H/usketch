// Global type definitions

import type { Shape } from "@usketch/shared-types";

declare global {
	interface Window {
		__lastCreatedShape?: Shape;
	}
}

// For Node.js environments
declare global {
	// biome-ignore lint: global declaration requires var
	var __lastCreatedShape: Shape | undefined;
}
