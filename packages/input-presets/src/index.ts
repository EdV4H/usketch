// Types

// Keyboard presets
export { defaultKeymap } from "./keyboard/default";
export { vimKeymap } from "./keyboard/vim";
// Mouse presets
export { defaultMouseMap } from "./mouse/default";
export { trackpadPreset } from "./mouse/trackpad";
export type {
	GestureType,
	KeyBindings,
	KeyboardPreset,
	MouseBinding,
	MouseBindings,
	MousePreset,
} from "./types";

// Preset collections - lazy loading
export const keyboardPresetsLazy = {
	default: () => import("./keyboard/default").then((m) => m.defaultKeymap),
	vim: () => import("./keyboard/vim").then((m) => m.vimKeymap),
};

export const mousePresetsLazy = {
	default: () => import("./mouse/default").then((m) => m.defaultMouseMap),
	trackpad: () => import("./mouse/trackpad").then((m) => m.trackpadPreset),
};

// Direct preset access (synchronous)
import { defaultKeymap as defaultKm } from "./keyboard/default";
import { vimKeymap as vimKm } from "./keyboard/vim";
import { defaultMouseMap as defaultMs } from "./mouse/default";
import { trackpadPreset as trackpadMs } from "./mouse/trackpad";
import type { KeyboardPreset, MousePreset } from "./types";

export const keyboardPresets: Record<string, KeyboardPreset> = {
	default: defaultKm,
	vim: vimKm,
};

export const mousePresets: Record<string, MousePreset> = {
	default: defaultMs,
	trackpad: trackpadMs,
};

// Helper functions
export const getKeyboardPreset = async (
	id: string,
): Promise<import("./types").KeyboardPreset | undefined> => {
	const loader = keyboardPresetsLazy[id as keyof typeof keyboardPresetsLazy];
	if (loader) {
		return await loader();
	}
	return undefined;
};

export const getMousePreset = async (
	id: string,
): Promise<import("./types").MousePreset | undefined> => {
	const loader = mousePresetsLazy[id as keyof typeof mousePresetsLazy];
	if (loader) {
		return await loader();
	}
	return undefined;
};
