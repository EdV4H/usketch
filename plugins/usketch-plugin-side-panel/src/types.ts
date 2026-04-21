import type { ReactNode } from "react";

export interface SidePanelTab {
	id: string;
	label: string;
	/** 絵文字やテキストの short icon（後方互換）。iconComponent があれば優先される。 */
	icon: string;
	/**
	 * React コンポーネントで icon を描画する場合に指定する。SVG アイコン等を使いたい場合はこちら。
	 * 指定があれば icon (文字列) より優先される。
	 */
	iconComponent?: () => ReactNode;
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
