import { createDefaultToolManagerOptions } from "../configs/default-tools";
import { ToolManagerV2 } from "./toolManagerAdapterV2";

/**
 * Backward compatibility wrapper for the original ToolManager
 * Creates a ToolManagerV2 instance with default tools
 */
export class ToolManager extends ToolManagerV2 {
	constructor() {
		// Initialize with default tools for backward compatibility
		super(createDefaultToolManagerOptions());
	}
}

/**
 * Factory function to create a ToolManager with default tools
 * (recommended for new code)
 */
export function createDefaultToolManager(): ToolManagerV2 {
	return new ToolManagerV2(createDefaultToolManagerOptions());
}
