// Core shape plugins
export * from "./core";
export { ellipsePlugin } from "./core/ellipse";
export { freedrawPlugin } from "./core/freedraw";
export { groupPlugin } from "./core/group";
// Re-export individual plugins for convenience
export { rectanglePlugin } from "./core/rectangle";

import type { ShapePlugin } from "@usketch/shape-registry";
import type { Shape } from "@usketch/shared-types";
import { ellipsePlugin } from "./core/ellipse";
import { freedrawPlugin } from "./core/freedraw";
import { groupPlugin } from "./core/group";
// Default plugins collection
import { rectanglePlugin } from "./core/rectangle";

// Export with proper typing for any shape type
export const defaultShapePlugins = [
	rectanglePlugin,
	ellipsePlugin,
	freedrawPlugin,
	groupPlugin,
] as readonly ShapePlugin<Shape>[];
