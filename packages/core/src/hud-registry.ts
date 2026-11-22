import type {
	HudPanel,
	HudRegistry,
	HudSettingsDescriptor,
	HudStatus,
} from "@edv4h/usketch-shared";

/**
 * Concrete registry type: the public {@link HudRegistry} plus internal
 * `registerSettingsFor`/`registerPanelFor` used by the app to stamp the owning
 * plugin id (see `createApp`'s per-plugin scoped context).
 */
export interface InternalHudRegistry extends HudRegistry {
	registerSettingsFor(pluginId: string | undefined, descriptor: HudSettingsDescriptor): () => void;
	registerPanelFor(pluginId: string | undefined, panel: HudPanel): () => void;
	registerStatusFor(pluginId: string | undefined, status: HudStatus): () => void;
	registerStatus(status: HudStatus): () => void;
	getStatuses(): readonly { pluginId: string | undefined; status: HudStatus }[];
	openSidePanel(id: string): void;
	toggleSidePanel(id: string): void;
	closeSidePanel(): void;
	getOpenSidePanel(): string | null;
}

interface SettingsEntry {
	pluginId: string | undefined;
	descriptor: HudSettingsDescriptor;
}
interface PanelEntry {
	pluginId: string | undefined;
	panel: HudPanel;
}
interface StatusEntry {
	pluginId: string | undefined;
	status: HudStatus;
}

/** Ordered by `order`, then registration order (explicit tie-break). */
function ordered<E>(ids: readonly string[], byId: Map<string, E>, orderOf: (e: E) => number): E[] {
	return ids
		.map((id, i) => ({ entry: byId.get(id), i }))
		.filter((x): x is { entry: E; i: number } => x.entry !== undefined)
		.sort((a, b) => orderOf(a.entry) - orderOf(b.entry) || a.i - b.i)
		.map((x) => x.entry);
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
	const statuses = new Map<string, StatusEntry>();
	const statusesOrder: string[] = [];
	let openSide: string | null = null;
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
			// A side panel that goes away closes (a re-registration under the id opens closed).
			if (openSide === panel.id) openSide = null;
			notify();
		};
	}

	function registerStatusFor(pluginId: string | undefined, status: HudStatus) {
		if (!statuses.has(status.id)) statusesOrder.push(status.id);
		statuses.set(status.id, { pluginId, status });
		notify();
		return () => {
			if (statuses.get(status.id)?.status !== status) return;
			statuses.delete(status.id);
			const i = statusesOrder.indexOf(status.id);
			if (i >= 0) statusesOrder.splice(i, 1);
			notify();
		};
	}

	function isSidePanel(id: string): boolean {
		return panels.get(id)?.panel.placement === "side";
	}

	function setOpenSide(id: string | null) {
		if (openSide === id) return;
		openSide = id;
		notify();
	}

	return {
		registerSettingsFor,
		registerPanelFor,
		registerStatusFor,
		registerSettings: (descriptor) => registerSettingsFor(undefined, descriptor),
		registerPanel: (panel) => registerPanelFor(undefined, panel),
		registerStatus: (status) => registerStatusFor(undefined, status),
		getSettings() {
			// Sort by `order`, then registration order — mirrors ActionRegistry.getOrdered.
			return ordered(settingsOrder, settings, (e) => e.descriptor.order ?? 0);
		},
		getPanels() {
			return ordered(panelsOrder, panels, (e) => e.panel.order ?? 0);
		},
		getStatuses() {
			return ordered(statusesOrder, statuses, (e) => e.status.order ?? 0);
		},
		openSidePanel(id) {
			if (isSidePanel(id)) setOpenSide(id);
		},
		toggleSidePanel(id) {
			if (openSide === id) setOpenSide(null);
			else if (isSidePanel(id)) setOpenSide(id);
		},
		closeSidePanel() {
			setOpenSide(null);
		},
		getOpenSidePanel: () => openSide,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
