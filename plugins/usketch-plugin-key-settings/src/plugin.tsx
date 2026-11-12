// One shared "キー設定" panel for every plugin's keys (the app's keymap), and where the
// viewer's rebindings are kept.
import {
	bindKeymapStorage,
	type KeymapStorage,
	localStorageKeymapStorage,
} from "@edv4h/usketch-core";
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { createElement } from "react";
import type { PickOptions } from "./key-settings-model.js";
import { KeySettingsPanel } from "./key-settings-panel.js";

export interface KeySettingsPluginOptions {
	/**
	 * Where the viewer's rebindings are kept (default: localStorage under
	 * `"usketch:keymap"`, per viewer and browser). `false` = the host keeps them itself
	 * (e.g. with its own `bindKeymapStorage`), or they last only for the session.
	 */
	storage?: KeymapStorage | false;
	/**
	 * Which keys the panel refuses and how a pressed combo is read (match the keymap's
	 * `mod` mode if the host changed it). Default: `Mod+W` / `T` / `N` / `Q` / `R`, Esc and
	 * Tab are refused.
	 */
	pick?: PickOptions;
	/** Sort order of the panel in the HUD (default 90). */
	order?: number;
}

export const KEY_SETTINGS_PLUGIN_ID = "usketch-plugin-key-settings";

export function createKeySettingsPlugin(options: KeySettingsPluginOptions = {}): UsketchPlugin {
	return {
		id: KEY_SETTINGS_PLUGIN_ID,
		name: "キー設定",
		setup(ctx: PluginContext) {
			const keymap = (ctx as Partial<PluginContext>).keymap;
			if (!keymap) return; // An older host without a keymap: nothing to show.
			const storage =
				options.storage === false
					? null
					: (options.storage ?? localStorageKeymapStorage({ key: "usketch:keymap" }));
			const stopStorage = storage ? bindKeymapStorage(keymap, storage) : null;
			const pluginName = (id: string | undefined): string | undefined =>
				id === undefined ? undefined : ctx.plugins.getAll().find((p) => p.id === id)?.name;
			const offPanel = ctx.hud.registerPanel({
				id: `${KEY_SETTINGS_PLUGIN_ID}:panel`,
				title: "キー設定",
				order: options.order ?? 90,
				render: () =>
					createElement(KeySettingsPanel, {
						keymap,
						pluginName,
						...(options.pick ? { pickOptions: options.pick } : {}),
					}),
			});
			return () => {
				offPanel();
				stopStorage?.();
			};
		},
	};
}
