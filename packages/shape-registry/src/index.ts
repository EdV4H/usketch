// Core exports

// React Context and Provider
export {
	ShapeRegistryProvider,
	useAvailableShapeTypes,
	useRegisterPlugin,
	useRegisterPlugins,
	useShapePlugin,
	useShapeRegistry,
} from "./context";
// Utility hooks
export {
	useCreateShape,
	useFilterShapesByType,
	useGroupShapesByType,
	usePluginsWithCapability,
	useRegistryStats,
	useShapeBounds,
	useShapeComponent,
	useShapeHitTest,
	useShapeSerialization,
	useShapeToolComponent,
	useValidateShape,
} from "./hooks";
export { globalShapeRegistry, ShapeRegistry } from "./ShapeRegistry";
// Type exports
export type {
	Bounds,
	CreateShapeProps,
	RegistryEvent,
	RegistryEventListener,
	RegistryEventType,
	ShapeComponentProps,
	ShapePlugin,
	ToolProps,
} from "./types";
export { UnifiedShapePluginAdapter } from "./UnifiedShapePluginAdapter";
