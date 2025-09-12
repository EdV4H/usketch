// Re-export all effect plugins

export { fadingPinPlugin } from "./fading-pin";
export { pinPlugin } from "./pin";
export { ripplePlugin } from "./ripple";

// Re-export types
export type {
	CreateEffectProps,
	EffectComponentProps,
	EffectPlugin,
} from "./types";
export { EffectRegistry } from "./types";
