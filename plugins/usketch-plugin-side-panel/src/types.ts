import type { ReactNode } from "react";

export interface SidePanelTab {
	id: string;
	label: string;
	icon: string;
	order: number;
	render: () => ReactNode;
}

export interface SidePanelRegisterEvent {
	tab: SidePanelTab;
}

export interface SidePanelUnregisterEvent {
	tabId: string;
}

export interface SidePanelOpenEvent {
	tabId?: string;
}
