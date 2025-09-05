// Core shape plugins
export * from "./core";
export { ellipsePlugin } from "./core/ellipse";
export { freedrawPlugin } from "./core/freedraw";
// Re-export individual plugins for convenience
export { rectanglePlugin } from "./core/rectangle";

import type { ShapePlugin } from "@usketch/shape-registry";
import type { Shape } from "@usketch/shared-types";
import { ellipsePlugin } from "./core/ellipse";
import { freedrawPlugin } from "./core/freedraw";
// Default plugins collection
import { rectanglePlugin } from "./core/rectangle";

// Export with proper typing for any shape type
export const defaultShapePlugins: ShapePlugin<Shape>[] = [
	rectanglePlugin as ShapePlugin<Shape>,
	ellipsePlugin as ShapePlugin<Shape>,
	freedrawPlugin as ShapePlugin<Shape>,
];
