import type { BaseEffect } from "@usketch/shared-types";
import { useCallback, useEffect, useRef } from "react";
import { useEffectRegistry } from "./context";
import type { CreateEffectProps, EffectPlugin } from "./types";

/**
 * Hook to create an effect using a plugin
 */
export const useCreateEffect = <T extends BaseEffect = BaseEffect>(
	type: string,
): ((props: Omit<CreateEffectProps, "id">) => T | null) => {
	const registry = useEffectRegistry();

	return useCallback(
		(props: Omit<CreateEffectProps, "id">) => {
			const plugin = registry.getPlugin(type) as EffectPlugin<T> | undefined;
			if (!plugin) {
				console.warn(`No plugin found for effect type: ${type}`);
				return null;
			}

			// Generate ID if not provided
			const id = `effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

			// Ensure x and y are provided with defaults if needed
			const fullProps: CreateEffectProps = {
				x: 0,
				y: 0,
				...props,
				id,
			};

			return plugin.createDefaultEffect(fullProps);
		},
		[registry, type],
	);
};

/**
 * Hook to validate an effect
 */
export const useValidateEffect = <T extends BaseEffect = BaseEffect>(effect: T | null): boolean => {
	const registry = useEffectRegistry();

	if (!effect) return false;

	const plugin = registry.getPlugin(effect.type) as EffectPlugin<T> | undefined;
	if (!plugin) return false;

	if (plugin.validate) {
		return plugin.validate(effect);
	}

	// Default validation
	return (
		typeof effect.id === "string" &&
		typeof effect.type === "string" &&
		typeof effect.x === "number" &&
		typeof effect.y === "number"
	);
};

/**
 * Hook to manage effect lifecycle
 */
export const useEffectLifecycle = <T extends BaseEffect = BaseEffect>(effect: T | null): void => {
	const registry = useEffectRegistry();
	const previousEffectRef = useRef<T | null>(null);

	useEffect(() => {
		if (!effect) return;

		const plugin = registry.getPlugin(effect.type) as EffectPlugin<T> | undefined;
		if (!plugin?.lifecycle) return;

		// Handle mount or update
		if (!previousEffectRef.current) {
			// Mount
			plugin.lifecycle.onMount?.(effect);
		} else if (previousEffectRef.current !== effect) {
			// Update
			plugin.lifecycle.onUpdate?.(previousEffectRef.current, effect);
		}

		// Update ref
		previousEffectRef.current = effect;

		// Handle unmount
		return () => {
			if (plugin.lifecycle?.onUnmount && previousEffectRef.current) {
				plugin.lifecycle.onUnmount(previousEffectRef.current);
			}
			previousEffectRef.current = null;
		};
	}, [effect, registry]);
};

/**
 * Hook to get interactive plugins
 */
export const useInteractiveEffectPlugins = (): EffectPlugin[] => {
	const registry = useEffectRegistry();
	const types = registry.getAvailableTypes();

	return types
		.map((type) => registry.getPlugin(type))
		.filter(
			(plugin): plugin is EffectPlugin => plugin !== undefined && plugin.interactive === true,
		);
};

/**
 * Hook to get plugin statistics
 */
export const useEffectRegistryStats = () => {
	const registry = useEffectRegistry();
	return registry.getStats();
};
