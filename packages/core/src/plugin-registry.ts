import type { UsketchPlugin } from "@edv4h/usketch-shared";

export function createPluginRegistry() {
	const plugins = new Map<string, UsketchPlugin>();

	return {
		register(plugin: UsketchPlugin): void {
			plugins.set(plugin.id, plugin);
		},

		get(id: string): UsketchPlugin | undefined {
			return plugins.get(id);
		},

		getAll(): readonly UsketchPlugin[] {
			return [...plugins.values()];
		},
	};
}
