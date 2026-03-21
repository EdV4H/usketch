import type { ReactElement } from "react";

export interface RadialMenuItem {
	id: string;
	label: string;
	icon: () => ReactElement;
}

export type { RadialMenuItem as RadialMenuItemType };
