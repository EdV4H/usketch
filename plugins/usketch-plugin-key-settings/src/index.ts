export { captureKeys } from "./key-capture.js";
export {
	applyPickedKey,
	bindingName,
	groupBindings,
	type KeySettingsGroup,
	MAX_KEYS_PER_BINDING,
	type PickOptions,
	type PickResult,
	sharersOf,
} from "./key-settings-model.js";
export { KeySettingsPanel, type KeySettingsPanelProps } from "./key-settings-panel.js";
export {
	createKeySettingsPlugin,
	KEY_SETTINGS_PLUGIN_ID,
	type KeySettingsPluginOptions,
} from "./plugin.js";
