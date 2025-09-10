// Core exports

// React Context and Provider
export {
	EffectRegistryProvider,
	useAvailableEffectTypes,
	useEffectPlugin,
	useEffectRegistry,
	useRegisterEffectPlugin,
	useRegisterEffectPlugins,
} from "./context";
export { EffectRegistry, globalEffectRegistry } from "./effect-registry";

// Hooks
export {
	useCreateEffect,
	useEffectLifecycle,
	useEffectRegistryStats,
	useInteractiveEffectPlugins,
	useValidateEffect,
} from "./hooks";

// Type exports
export type {
	CreateEffectProps,
	EffectComponentProps,
	EffectPlugin,
	EffectRegistryProviderProps,
	InteractionEvent,
	RegistryEvent,
	RegistryEventListener,
	RegistryEventType,
} from "./types";
