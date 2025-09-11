// Plugin exports

// Metadata exports
export { getAllPresetIds, getPresetMetadata, PRESET_EFFECTS_METADATA } from "./metadata";
export type { FadingPinEffectConfig } from "./plugins/fading-pin";
export { fadingPinPlugin } from "./plugins/fading-pin";
export type { PinEffectConfig } from "./plugins/pin";
export { pinPlugin } from "./plugins/pin";
export type { RippleEffectConfig } from "./plugins/ripple";
export { ripplePlugin } from "./plugins/ripple";

// Registry helper functions
import type { EffectRegistry } from "@usketch/effect-registry";
import { fadingPinPlugin } from "./plugins/fading-pin";
import { pinPlugin } from "./plugins/pin";
import { ripplePlugin } from "./plugins/ripple";

/**
 * Register all uSketch preset effects to a registry
 */
export function registerPresetEffects(registry: EffectRegistry): void {
	registry.register(ripplePlugin);
	registry.register(pinPlugin);
	registry.register(fadingPinPlugin);
	// Additional plugins will be added here as they are implemented
}

/**
 * Get all preset plugins as an array
 */
export function getAllPresetPlugins() {
	return [
		ripplePlugin,
		pinPlugin,
		fadingPinPlugin,
		// Additional plugins will be added here as they are implemented
	];
}
