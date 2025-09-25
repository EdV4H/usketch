// Re-export all types

// Re-export keyboard presets
export * from "./keyboard";
// Re-export mouse presets
export * from "./mouse";
export * from "./types";

// Preset collections for easy access
import { defaultKeyboardPreset, vimKeyboardPreset } from "./keyboard";
import { defaultMousePreset, gamingMousePreset, trackpadMousePreset } from "./mouse";

export const keyboardPresets = {
	default: defaultKeyboardPreset,
	vim: vimKeyboardPreset,
} as const;

export const mousePresets = {
	default: defaultMousePreset,
	trackpad: trackpadMousePreset,
	gaming: gamingMousePreset,
} as const;
