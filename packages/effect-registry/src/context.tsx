import type React from "react";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { type EffectRegistry, globalEffectRegistry } from "./effect-registry";
import type { EffectPlugin } from "./types";

/**
 * Context value for effect registry
 */
interface EffectRegistryContextValue {
	registry: EffectRegistry;
	availableTypes: string[];
}

const EffectRegistryContext = createContext<EffectRegistryContextValue | null>(null);

/**
 * Props for EffectRegistryProvider
 */
export interface EffectRegistryProviderProps extends PropsWithChildren {
	/** Plugins to register on mount */
	plugins?: EffectPlugin[];
	/** Custom registry instance (defaults to global) */
	registry?: EffectRegistry;
}

/**
 * Provider component for effect registry
 */
export const EffectRegistryProvider: React.FC<EffectRegistryProviderProps> = ({
	children,
	plugins = [],
	registry = globalEffectRegistry,
}) => {
	const [availableTypes, setAvailableTypes] = useState<string[]>(() =>
		registry.getAvailableTypes(),
	);

	useEffect(() => {
		// Register plugins (only once per plugin)
		const registeredTypes = new Set<string>();
		for (const plugin of plugins) {
			// Check if this plugin type is already registered
			if (!registry.getPlugin(plugin.type)) {
				registry.register(plugin);
				registeredTypes.add(plugin.type);
			}
		}

		// Update available types
		const updateTypes = () => {
			setAvailableTypes(registry.getAvailableTypes());
		};

		// Initial update
		updateTypes();

		// Listen for registry changes
		registry.addEventListener(updateTypes);

		return () => {
			registry.removeEventListener(updateTypes);
			// Unregister only the plugins we registered
			for (const type of registeredTypes) {
				registry.unregister(type);
			}
		};
	}, [registry, plugins]);

	return (
		<EffectRegistryContext.Provider value={{ registry, availableTypes }}>
			{children}
		</EffectRegistryContext.Provider>
	);
};

/**
 * Hook to access the effect registry
 */
export const useEffectRegistry = (): EffectRegistry => {
	const context = useContext(EffectRegistryContext);
	if (!context) {
		// Return global registry if not in provider
		return globalEffectRegistry;
	}
	return context.registry;
};

/**
 * Hook to get a specific effect plugin
 */
export const useEffectPlugin = (type: string): EffectPlugin | undefined => {
	const registry = useEffectRegistry();
	const [plugin, setPlugin] = useState<EffectPlugin | undefined>(() => registry.getPlugin(type));

	useEffect(() => {
		const updatePlugin = () => {
			setPlugin(registry.getPlugin(type));
		};

		updatePlugin();
		registry.addEventListener(updatePlugin);

		return () => {
			registry.removeEventListener(updatePlugin);
		};
	}, [registry, type]);

	return plugin;
};

/**
 * Hook to get all available effect types
 */
export const useAvailableEffectTypes = (): string[] => {
	const context = useContext(EffectRegistryContext);
	const registry = context?.registry || globalEffectRegistry;
	const [types, setTypes] = useState<string[]>(
		() => context?.availableTypes || registry.getAvailableTypes(),
	);

	useEffect(() => {
		if (!context) {
			const updateTypes = () => {
				setTypes(registry.getAvailableTypes());
			};

			updateTypes();
			registry.addEventListener(updateTypes);

			return () => {
				registry.removeEventListener(updateTypes);
			};
		}
	}, [context, registry]);

	return context?.availableTypes || types;
};

/**
 * Hook to register plugins
 */
export const useRegisterEffectPlugin = (plugin: EffectPlugin | undefined): void => {
	const registry = useEffectRegistry();

	useEffect(() => {
		if (plugin) {
			registry.register(plugin);
			return () => {
				registry.unregister(plugin.type);
			};
		}
	}, [registry, plugin]);
};

/**
 * Hook to register multiple plugins
 */
export const useRegisterEffectPlugins = (plugins: EffectPlugin[]): void => {
	const registry = useEffectRegistry();

	useEffect(() => {
		registry.registerMultiple(plugins);
		return () => {
			for (const plugin of plugins) {
				registry.unregister(plugin.type);
			}
		};
	}, [registry, plugins]);
};
