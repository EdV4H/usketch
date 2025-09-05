// Main exports

// Re-export presets from @usketch/background-presets for backward compatibility
export {
	AnimatedGridBackground,
	DotsBackground,
	type DotsBackgroundConfig,
	GradientBackground,
	type GradientBackgroundConfig,
	GridBackground,
	type GridBackgroundConfig,
	IsometricBackground,
	type IsometricBackgroundConfig,
	LinesBackground,
	type LinesBackgroundConfig,
	PulseBackground,
	type PulseBackgroundConfig,
} from "@usketch/background-presets";
// Background Registry
export { BackgroundRegistry, globalBackgroundRegistry } from "./backgrounds/BackgroundRegistry";
export {
	getAllPresetIds,
	getPresetsByCategory,
	PRESET_BACKGROUNDS_METADATA,
	type PresetCategory,
	registerPresetBackgrounds,
} from "./backgrounds/presets";
export type { BackgroundComponent, BackgroundComponentProps } from "./backgrounds/types";
export { BackgroundLayer } from "./components/BackgroundLayer";
export { InteractionLayer } from "./components/InteractionLayer";
export { SelectionLayer } from "./components/SelectionLayer";
export { ShapeLayer } from "./components/ShapeLayer";
export { WhiteboardCanvas } from "./components/WhiteboardCanvas";

// Hooks
export { useBackgroundRenderer } from "./hooks/useBackgroundRenderer";
export { useCanvas } from "./hooks/useCanvas";
export { useInteraction } from "./hooks/useInteraction";
export { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
export { useShapeManagement } from "./hooks/useShapeManagement";

// Types
export type { CanvasProps, LayerProps } from "./types";
