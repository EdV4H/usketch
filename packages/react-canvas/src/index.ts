// Main exports

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
