// Main exports for @usketch/canvas-react package

export type { CanvasProps, CanvasRef } from "./components/canvas";
// Components
export { Canvas } from "./components/canvas";
// Components (for advanced usage)
export { CanvasView } from "./components/canvas-view";
export { BackgroundLayer } from "./components/layers/background-layer";
export { PreviewLayer } from "./components/layers/preview-layer";
export { SelectionLayer } from "./components/layers/selection-layer";
export { ShapeLayer } from "./components/layers/shape-layer";
export { EllipseShape } from "./components/shapes/ellipse-shape";
export { FreedrawShape } from "./components/shapes/freedraw-shape";
export { RectangleShape } from "./components/shapes/rectangle-shape";

// Shape components
export { ShapeComponent } from "./components/shapes/shape-component";
export type { UseCanvasOptions } from "./hooks/use-canvas";
// Hooks
export { useCanvas } from "./hooks/use-canvas";
// Renderer
export { ReactRenderer } from "./renderers/react-renderer";
