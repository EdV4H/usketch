// Main export for the canvas-core package
// Export the adapter as Canvas for backward compatibility

// Keep the old Canvas implementation available for migration period
export { Canvas as LegacyCanvas } from "./canvas";
export type { CanvasOptions } from "./canvas-adapter";
export { Canvas } from "./canvas-adapter";
export type { Renderer, RendererEventHandlers, RendererFactory } from "./interfaces/renderer";
// Also export new architecture components for direct use
export { CanvasManager } from "./managers/canvas-manager";
export { VanillaRenderer } from "./renderers/vanilla-renderer";
