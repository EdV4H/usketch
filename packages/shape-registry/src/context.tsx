import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ShapeRegistry } from "./ShapeRegistry";
import type { RegistryEvent, ShapePlugin } from "./types";

/**
 * Shape Registry Context
 */
interface ShapeRegistryContextValue {
	registry: ShapeRegistry;
	registeredTypes: string[];
	registerPlugin: (plugin: ShapePlugin) => void;
	unregisterPlugin: (type: string) => void;
	getPlugin: (type: string) => ShapePlugin | undefined;
	hasPlugin: (type: string) => boolean;
}

const ShapeRegistryContext = createContext<ShapeRegistryContextValue | null>(null);

/**
 * Shape Registry Provider Props
 */
interface ShapeRegistryProviderProps {
	children: ReactNode;
	/** Optional: Use a custom registry instance */
	registry?: ShapeRegistry;
	/** Optional: Initial plugins to register */
	plugins?: readonly ShapePlugin<any>[];
	/** Optional: Callback when registry changes */
	onRegistryChange?: (event: RegistryEvent) => void;
}

/**
 * Shape Registry Provider Component
 */
export function ShapeRegistryProvider({
	children,
	registry: customRegistry,
	plugins = [],
	onRegistryChange,
}: ShapeRegistryProviderProps) {
	// Use custom registry or create a new one
	const registryRef = useRef<ShapeRegistry>(customRegistry || new ShapeRegistry());
	const registry = registryRef.current;

	// Track registered types for reactivity
	const [registeredTypes, setRegisteredTypes] = useState<string[]>(() =>
		registry.getRegisteredTypes(),
	);

	// Register initial plugins
	useEffect(() => {
		if (plugins.length > 0) {
			plugins.forEach((plugin) => {
				if (!registry.hasPlugin(plugin.type)) {
					registry.register(plugin);
				}
			});
			setRegisteredTypes(registry.getRegisteredTypes());
		}
	}, [plugins, registry]); // Re-run when plugins change

	// Setup registry change listener
	useEffect(() => {
		const unsubscribe = registry.addEventListener((event) => {
			setRegisteredTypes(registry.getRegisteredTypes());
			onRegistryChange?.(event);
		});

		return unsubscribe;
	}, [registry, onRegistryChange]);

	// Context value with memoization
	const contextValue = useMemo<ShapeRegistryContextValue>(
		() => ({
			registry,
			registeredTypes,
			registerPlugin: (plugin) => {
				registry.register(plugin);
			},
			unregisterPlugin: (type) => {
				registry.unregister(type);
			},
			getPlugin: (type) => {
				return registry.getPlugin(type);
			},
			hasPlugin: (type) => {
				return registry.hasPlugin(type);
			},
		}),
		[registry, registeredTypes],
	);

	return (
		<ShapeRegistryContext.Provider value={contextValue}>{children}</ShapeRegistryContext.Provider>
	);
}

/**
 * Hook to use the shape registry
 */
export function useShapeRegistry(): ShapeRegistryContextValue {
	const context = useContext(ShapeRegistryContext);

	if (!context) {
		throw new Error("useShapeRegistry must be used within a ShapeRegistryProvider");
	}

	return context;
}

/**
 * Hook to get a specific shape plugin
 */
export function useShapePlugin(type: string): ShapePlugin | undefined {
	const { getPlugin, registeredTypes } = useShapeRegistry();

	// Re-render when registeredTypes changes
	return useMemo(() => getPlugin(type), [type, getPlugin]);
}

/**
 * Hook to get all available shape types
 */
export function useAvailableShapeTypes(): string[] {
	const { registeredTypes } = useShapeRegistry();
	return registeredTypes;
}

/**
 * Hook to register a plugin with automatic cleanup
 */
export function useRegisterPlugin(plugin: ShapePlugin | null): void {
	const { registerPlugin, unregisterPlugin } = useShapeRegistry();

	useEffect(() => {
		if (plugin) {
			registerPlugin(plugin);

			return () => {
				unregisterPlugin(plugin.type);
			};
		}
	}, [plugin, registerPlugin, unregisterPlugin]);
}

/**
 * Hook to register multiple plugins with automatic cleanup
 */
export function useRegisterPlugins(plugins: ShapePlugin[]): void {
	const { registry } = useShapeRegistry();

	useEffect(() => {
		if (plugins.length === 0) return;

		// Register all plugins
		plugins.forEach((plugin) => {
			if (!registry.hasPlugin(plugin.type)) {
				registry.register(plugin);
			}
		});

		// Cleanup: unregister plugins on unmount
		return () => {
			plugins.forEach((plugin) => {
				registry.unregister(plugin.type);
			});
		};
	}, [plugins, registry]);
}
