import { createDefaultToolManagerOptions } from "../configs/default-tools";
import type { ToolManagerOptions } from "../schemas";
import { ToolManager } from "./tool-manager-adapter";

/**
 * Factory function to create a ToolManager with default tools
 * Use this for backward compatibility with existing code that expects default tools
 */
export function createDefaultToolManager(
	overrides?: Partial<Omit<ToolManagerOptions, "tools">>,
): ToolManager {
	const defaultOptions = createDefaultToolManagerOptions();
	const options = {
		...defaultOptions,
		...overrides,
	};
	return new ToolManager(options);
}
