import type { ReactElement } from "react";

export interface SidePanelTab {
	id: string;
	label: string;
	icon: string;
	order: number;
	render: () => ReactElement;
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
