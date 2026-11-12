import type { ActionRegistry } from "@edv4h/usketch-shared";
import { createActionRegistry as createActionRegistryImpl } from "./action-registry.js";

// Narrow the public factory to {@link ActionRegistry}: the internal `registerFor`
// (plugin-id stamping) stays out of the package surface, used only by createApp
// (which imports the impl directly). `createHudRegistry` is intentionally NOT
// exported — it's an internal implementation detail of createApp.
export const createActionRegistry: () => ActionRegistry = createActionRegistryImpl;
export { createCommandRegistry } from "./command-registry.js";
export type { AppInstance, CreateAppOptions } from "./create-app.js";
export { createApp } from "./create-app.js";
export { createEventBus } from "./event-bus.js";
export { createExternalContentRegistry } from "./external-content-registry.js";
export {
	type ComboOptions,
	type CreateKeymapOptions,
	codeToKey,
	createKeymap,
	describeConflicts,
	eventToCombo,
	eventToCombos,
	type KeymapInternal,
	type KeymapOwner,
	type ModKeyMode,
	normalizeCombo,
	scopeKeymap,
} from "./keymap.js";
export {
	bindKeymapStorage,
	type KeymapOverrides,
	type KeymapStorage,
	type LocalStorageKeymapStorageOptions,
	localStorageKeymapStorage,
	parseKeymapOverrides,
} from "./keymap-storage.js";
export {
	type AssignKeyOptions,
	type AssignKeyResult,
	assignKey,
	bindingsUsingKey,
	comboFromKeyEvent,
	DEFAULT_RESERVED_COMBOS,
	type FormatComboOptions,
	type FormatKeyCodeOptions,
	formatBindingKey,
	formatCombo,
	formatKeyCode,
	isReservedCombo,
	type ReservedComboOptions,
	unassignKey,
} from "./keymap-ui.js";
export { createLayerManager } from "./layer-manager.js";
export type { CreateLodControllerOptions, LodControllerInternal } from "./lod/index.js";
export {
	createCompositeLodPolicy,
	createFpsLodPolicy,
	createLodController,
	createShapeCountLodPolicy,
	createZoomLodPolicy,
} from "./lod/index.js";
export { createPluginRegistry } from "./plugin-registry.js";
export { createSelectionForegroundRegistry } from "./selection-foreground-registry.js";
export { createServiceRegistry } from "./service-registry.js";
export { createShapeRegistry } from "./shape-registry.js";
export { createShortcutRegistry } from "./shortcut-registry.js";
export { createToolRegistry } from "./tool-registry.js";
export { createTransientRegistry } from "./transient-registry.js";
