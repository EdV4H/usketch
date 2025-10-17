import type React from "react";
import { TabButton } from "./tab-button";
import type { SidebarPanel } from "./types";

interface SidebarTabsProps {
	panels: SidebarPanel[];
	activeTab: string | null;
	onTabChange: (tabId: string) => void;
}

/**
 * Sidebar Tabs Component
 *
 * Displays the tab header for the sidebar.
 * Shows all visible panels as tabs with their icons and badges.
 */
export const SidebarTabs: React.FC<SidebarTabsProps> = ({ panels, activeTab, onTabChange }) => {
	if (panels.length === 0) {
		return null;
	}

	return (
		<div className="sidebar-tabs" role="tablist">
			{panels.map((panel) => (
				<TabButton
					key={panel.id}
					panel={panel}
					isActive={activeTab === panel.id}
					onClick={() => onTabChange(panel.id)}
				/>
			))}
		</div>
	);
};
