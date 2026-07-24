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
			// Guard: only remove if THIS descriptor is still the current one, so a
			// stale unsubscribe can't clobber a re-registration under the same id.
			if (settings.get(descriptor.id)?.descriptor !== descriptor) return;
			settings.delete(descriptor.id);
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
			if (panels.get(panel.id)?.panel !== panel) return;
			panels.delete(panel.id);
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
			// Sort by `order`, then registration order (explicit tie-break, not relying
			// on Array.sort stability) — mirrors ActionRegistry.getOrdered.
			return settingsOrder
				.map((id, i) => ({ entry: settings.get(id), i }))
				.filter((x): x is { entry: SettingsEntry; i: number } => x.entry !== undefined)
				.sort(
					(a, b) => (a.entry.descriptor.order ?? 0) - (b.entry.descriptor.order ?? 0) || a.i - b.i,
				)
				.map((x) => x.entry);
		},
		getPanels() {
			return panelsOrder
				.map((id, i) => ({ entry: panels.get(id), i }))
				.filter((x): x is { entry: PanelEntry; i: number } => x.entry !== undefined)
				.sort((a, b) => (a.entry.panel.order ?? 0) - (b.entry.panel.order ?? 0) || a.i - b.i)
				.map((x) => x.entry);
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
