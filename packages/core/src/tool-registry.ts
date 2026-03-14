import type { ToolDefinition, ToolRegistry } from "@usketch/shared";

export function createToolRegistry(): ToolRegistry {
	const tools = new Map<string, ToolDefinition>();

	return {
		register(id: string, definition: ToolDefinition): void {
			tools.set(id, definition);
		},

		get(id: string): ToolDefinition | undefined {
			return tools.get(id);
		},

		getAll(): ReadonlyMap<string, ToolDefinition> {
			return tools;
		},

		getOrdered(): readonly { id: string; definition: ToolDefinition }[] {
			return [...tools.entries()]
				.map(([id, definition]) => ({ id, definition }))
				.sort((a, b) => (a.definition.order ?? 0) - (b.definition.order ?? 0));
		},
	};
}
