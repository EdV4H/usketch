import { createDefaultToolManagerOptions } from "../configs/default-tools";
import { ToolManager } from "./tool-manager-adapter";

/**
 * Factory function to create a ToolManager with default tools
 * Use this for backward compatibility with existing code that expects default tools
 */
export function createDefaultToolManager(): ToolManager {
	return new ToolManager(createDefaultToolManagerOptions());
}
