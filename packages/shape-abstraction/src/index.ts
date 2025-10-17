// Core classes

// Re-export commonly used types from shared-types
export type { Bounds, Camera, Point, Shape } from "@usketch/shared-types";
export { BaseShape } from "./base-shape";
export { SvgWrapper } from "./components/svg-wrapper";
export { ShapeFactory } from "./shape-factory";
// Types
export type {
	BaseShapeConfig,
	RenderMode,
	ResizeHandle,
	ShapeRenderer,
	ShapeRendererConstructor,
} from "./types";
