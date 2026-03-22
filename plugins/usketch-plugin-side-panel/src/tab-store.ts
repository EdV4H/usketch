import type { SidePanelTab } from "./types.js";

export type TabStoreListener = () => void;

export interface TabStore {
	getTabs(): SidePanelTab[];
	register(tab: SidePanelTab): void;
	unregister(tabId: string): void;
	subscribe(listener: TabStoreListener): () => void;
}

export function createTabStore(): TabStore {
	let tabs: SidePanelTab[] = [];
	const listeners = new Set<TabStoreListener>();

	function notify() {
		for (const l of listeners) l();
	}

	return {
		getTabs() {
			return tabs;
		},
		register(tab) {
			if (tabs.some((t) => t.id === tab.id)) return;
			tabs = [...tabs, tab].sort((a, b) => a.order - b.order);
			notify();
		},
		unregister(tabId) {
			tabs = tabs.filter((t) => t.id !== tabId);
			notify();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
