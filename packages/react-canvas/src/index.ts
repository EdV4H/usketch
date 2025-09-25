// Main exports

// Re-export presets from @usketch/background-presets for backward compatibility
export {
	DotsBackground,
	type DotsBackgroundConfig,
	GridBackground,
	type GridBackgroundConfig,
	IsometricBackground,
	type IsometricBackgroundConfig,
	LinesBackground,
	type LinesBackgroundConfig,
} from "@usketch/background-presets";
// Background Registry
export { BackgroundRegistry, globalBackgroundRegistry } from "./backgrounds/background-registry";
export {
	getAllPresetIds,
	PRESET_BACKGROUNDS_METADATA,
	registerPresetBackgrounds,
} from "./backgrounds/presets";
export type { BackgroundComponent, BackgroundComponentProps } from "./backgrounds/types";
export { BackgroundLayer } from "./components/background-layer";
export { DefaultSelectionIndicator } from "./components/default-selection-indicator";
export { InteractionLayer } from "./components/interaction-layer";
export { SelectionLayer } from "./components/selection-layer";
export { ShapeLayer } from "./components/shape-layer";
export { WhiteboardCanvas } from "./components/whiteboard-canvas";
// Hooks
export { useBackgroundRenderer } from "./hooks/use-background-renderer";
export { useCanvas } from "./hooks/use-canvas";
export { useInteraction } from "./hooks/use-interaction";
export { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
export { useSelectionIndicator } from "./hooks/use-selection-indicator";
export { useShapeManagement } from "./hooks/use-shape-management";

// Input System
export {
	type CommandRegistration,
	createAppCommands,
	createCameraCommands,
	type InputContextValue,
	InputProvider,
	type InputProviderProps,
	useCommand,
	useCommandRegistration,
	useInput,
	useWhiteboardCommands,
} from "./input";
export { EffectLayer } from "./layers/effect-layer";

// Types
export type {
	CanvasProps,
	InteractionLayerProps,
	LayerProps,
	SelectionIndicatorProps,
} from "./types";
