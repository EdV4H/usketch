// Core shape plugins
export * from "./core";
export { ellipsePlugin } from "./core/ellipse";
export { freedrawPlugin } from "./core/freedraw";
// Re-export individual plugins for convenience
export { rectanglePlugin } from "./core/rectangle";

import { ellipsePlugin } from "./core/ellipse";
import { freedrawPlugin } from "./core/freedraw";
// Default plugins collection
import { rectanglePlugin } from "./core/rectangle";

export const defaultShapePlugins = [rectanglePlugin, ellipsePlugin, freedrawPlugin];
