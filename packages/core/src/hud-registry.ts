import type { HudPanel, HudRegistry, HudSettingsDescriptor } from "@edv4h/usketch-shared";

/**
 * Concrete registry type: the public {@link HudRegistry} plus internal
 * `registerSettingsFor`/`registerPanelFor` used by the app to stamp the owning
 * plugin id (see `createApp`'s per-plugin scoped context).
 */
export interface InternalHudRegistry extends HudRegistry {
	registerSettingsFor(pluginId: string | undefined, descriptor: HudSettingsDescriptor): () => void;
	registerPanelFor(pluginId: string | undefined, panel: HudPanel): () => void;
}

interface SettingsEntry {
	pluginId: string | undefined;
	descriptor: HudSettingsDescriptor;
}
interface PanelEntry {
	pluginId: string | undefined;
	panel: HudPanel;
}

/**
 * Registry for declarative HUD contributions beyond {@link PluginAction}s: live
 * {@link HudSettingsDescriptor}s and custom {@link HudPanel}s. Entries are
 * attributed to the registering plugin (via the scoped context) so the HUD can
 * render them under that plugin's section. `subscribe` lets the HUD re-render on
 * register/unregister.
 */
export function createHudRegistry(): InternalHudRegistry {
	const settings = new Map<string, SettingsEntry>();
	const panels = new Map<string, PanelEntry>();
	const settingsOrder: string[] = [];
	const panelsOrder: string[] = [];
	const listeners = new Set<() => void>();

	function notify() {
		for (const fn of listeners) fn();
	}

	function registerSettingsFor(pluginId: string | undefined, descriptor: HudSettingsDescriptor) {
		if (!settings.has(descriptor.id)) settingsOrder.push(descriptor.id);
		settings.set(descriptor.id, { pluginId, descriptor });
		notify();
		return () => {
			if (!settings.delete(descriptor.id)) return;
			const i = settingsOrder.indexOf(descriptor.id);
			if (i >= 0) settingsOrder.splice(i, 1);
			notify();
		};
	}

	function registerPanelFor(pluginId: string | undefined, panel: HudPanel) {
		if (!panels.has(panel.id)) panelsOrder.push(panel.id);
		panels.set(panel.id, { pluginId, panel });
		notify();
		return () => {
			if (!panels.delete(panel.id)) return;
			const i = panelsOrder.indexOf(panel.id);
			if (i >= 0) panelsOrder.splice(i, 1);
			notify();
		};
	}

	return {
		registerSettingsFor,
		registerPanelFor,
		registerSettings: (descriptor) => registerSettingsFor(undefined, descriptor),
		registerPanel: (panel) => registerPanelFor(undefined, panel),
		getSettings() {
			return settingsOrder
				.map((id) => settings.get(id))
				.filter((e): e is SettingsEntry => e !== undefined)
				.sort((a, b) => (a.descriptor.order ?? 0) - (b.descriptor.order ?? 0));
		},
		getPanels() {
			return panelsOrder
				.map((id) => panels.get(id))
				.filter((e): e is PanelEntry => e !== undefined)
				.sort((a, b) => (a.panel.order ?? 0) - (b.panel.order ?? 0));
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
