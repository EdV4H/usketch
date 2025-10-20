// Core exports

export type { ForeignObjectShapeProps } from "./components/foreign-object-shape";
export { ForeignObjectShape } from "./components/foreign-object-shape";
// React Context and Provider
export {
	ShapeRegistryProvider,
	type ShapeRegistryProviderProps,
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
export { globalShapeRegistry, ShapeRegistry } from "./shape-registry";
// Type exports
export type {
	Bounds,
	CreateShapeProps,
	MinimalShape,
	RegistryEvent,
	RegistryEventListener,
	RegistryEventType,
	ShapeComponentProps,
	ShapePlugin,
	ToolProps,
} from "./types";
