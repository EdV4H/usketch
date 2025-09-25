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

// Preset collections
export const keyboardPresets = {
	default: () => import("./keyboard/default").then((m) => m.defaultKeymap),
	vim: () => import("./keyboard/vim").then((m) => m.vimKeymap),
};

export const mousePresets = {
	default: () => import("./mouse/default").then((m) => m.defaultMouseMap),
	trackpad: () => import("./mouse/trackpad").then((m) => m.trackpadPreset),
};

// Helper functions
export const getKeyboardPreset = async (
	id: string,
): Promise<import("./types").KeyboardPreset | undefined> => {
	const loader = keyboardPresets[id as keyof typeof keyboardPresets];
	if (loader) {
		return await loader();
	}
	return undefined;
};

export const getMousePreset = async (
	id: string,
): Promise<import("./types").MousePreset | undefined> => {
	const loader = mousePresets[id as keyof typeof mousePresets];
	if (loader) {
		return await loader();
	}
	return undefined;
};
