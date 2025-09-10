import type { BaseEffect } from "@usketch/shared-types";
import type { EffectPlugin, RegistryEvent, RegistryEventListener } from "./types";

/**
 * Registry for managing effect plugins
 */
export class EffectRegistry {
	private plugins = new Map<string, EffectPlugin>();
	private listeners = new Set<RegistryEventListener>();

	/**
	 * Register an effect plugin
	 */
	register<T extends BaseEffect>(plugin: EffectPlugin<T>): void {
		if (this.plugins.has(plugin.type)) {
			console.warn(`Effect plugin "${plugin.type}" is already registered. Overwriting.`);
		}
		this.plugins.set(plugin.type, plugin as unknown as EffectPlugin);
		this.notifyListeners({
			type: "register",
			effectType: plugin.type,
			plugin: plugin as unknown as EffectPlugin,
		});
	}

	/**
	 * Register multiple plugins at once
	 */
	registerMultiple(plugins: EffectPlugin[]): void {
		for (const plugin of plugins) {
			this.register(plugin);
		}
	}

	/**
	 * Get a plugin by type
	 */
	getPlugin(type: string): EffectPlugin | undefined {
		return this.plugins.get(type);
	}

	/**
	 * Get all available effect types
	 */
	getAvailableTypes(): string[] {
		return Array.from(this.plugins.keys());
	}

	/**
	 * Check if a plugin is registered
	 */
	hasPlugin(type: string): boolean {
		return this.plugins.has(type);
	}

	/**
	 * Unregister a plugin
	 */
	unregister(type: string): void {
		const plugin = this.plugins.get(type);
		if (plugin) {
			this.plugins.delete(type);
			this.notifyListeners({ type: "unregister", effectType: type, plugin });
		}
	}

	/**
	 * Clear all plugins
	 */
	clear(): void {
		const types = this.getAvailableTypes();
		for (const type of types) {
			this.unregister(type);
		}
	}

	/**
	 * Add an event listener
	 */
	addEventListener(listener: RegistryEventListener): void {
		this.listeners.add(listener);
	}

	/**
	 * Remove an event listener
	 */
	removeEventListener(listener: RegistryEventListener): void {
		this.listeners.delete(listener);
	}

	/**
	 * Notify all listeners of an event
	 */
	private notifyListeners(event: RegistryEvent): void {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				console.error("Error in registry event listener:", error);
			}
		}
	}

	/**
	 * Get registry statistics
	 */
	getStats(): {
		pluginCount: number;
		types: string[];
		interactiveCount: number;
	} {
		const types = this.getAvailableTypes();
		const interactiveCount = types.filter((type) => {
			const plugin = this.getPlugin(type);
			return plugin?.interactive === true;
		}).length;

		return {
			pluginCount: types.length,
			types,
			interactiveCount,
		};
	}
}

/**
 * Global effect registry instance
 */
export const globalEffectRegistry = new EffectRegistry();
