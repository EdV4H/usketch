import type { ReactNode } from "react";

/**
 * Sidebar panel definition
 *
 * Defines a single panel that can be displayed in the sidebar.
 * Panels are registered in the SidebarPanelRegistry and displayed as tabs.
 */
export interface SidebarPanel {
	/**
	 * Unique identifier for the panel
	 * @example 'properties', 'debug', 'history'
	 */
	id: string;

	/**
	 * Display label for the tab
	 * @example 'プロパティ', 'デバッグ', '履歴'
	 */
	label: string;

	/**
	 * Icon to display in the tab (optional)
	 * Can be a React component or element
	 */
	icon?: ReactNode;

	/**
	 * Badge to display on the tab (optional)
	 * Can be a string (e.g., "New") or number (e.g., 5 for notification count)
	 */
	badge?: string | number;

	/**
	 * Panel content to render when tab is active
	 */
	content: ReactNode;

	/**
	 * Visibility condition (optional)
	 * - boolean: Static visibility
	 * - function: Dynamic visibility based on app state
	 * @default true
	 */
	visible?: boolean | (() => boolean);

	/**
	 * Development-only panel (optional)
	 * If true, panel is only visible in development mode
	 * @default false
	 */
	devOnly?: boolean;

	/**
	 * Keyboard shortcut to activate this tab (optional)
	 * @example 'Cmd+1', 'Cmd+2', 'Cmd+3'
	 */
	shortcut?: string;

	/**
	 * Display order in the tab list (optional)
	 * Lower numbers appear first
	 * @default 0
	 */
	order?: number;
}

/**
 * Sidebar state
 *
 * Manages the current state of the sidebar including
 * open/closed state and active tab.
 */
export interface SidebarState {
	/**
	 * Whether the sidebar is currently open
	 */
	isOpen: boolean;

	/**
	 * ID of the currently active tab
	 */
	activeTab: string | null;
}

/**
 * Sidebar panel registry listener
 *
 * Callback function that is called when panels are registered or unregistered.
 */
export type SidebarRegistryListener = () => void;
