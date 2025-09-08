// Core classes

// Re-export commonly used types from shared-types
export type { Bounds, Camera, Point, Shape } from "@usketch/shared-types";
export { BaseShape } from "./BaseShape";
export { HtmlWrapper } from "./components/HtmlWrapper";
export { HybridWrapper } from "./components/HybridWrapper";
export { SvgWrapper } from "./components/SvgWrapper";
// Components
export { UnifiedShapeRenderer } from "./components/UnifiedShapeRenderer";
export { ShapeFactory } from "./ShapeFactory";
// Types
export type {
	BaseShapeConfig,
	RenderMode,
	ResizeHandle,
	ShapeRenderer,
	ShapeRendererConstructor,
} from "./types";
