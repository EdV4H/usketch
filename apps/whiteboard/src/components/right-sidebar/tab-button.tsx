import type React from "react";
import type { SidebarPanel } from "./types";

interface TabButtonProps {
	panel: SidebarPanel;
	isActive: boolean;
	onClick: () => void;
}

/**
 * Tab Button Component
 *
 * Displays a single tab button in the sidebar.
 * Shows icon, label, and optional badge.
 */
export const TabButton: React.FC<TabButtonProps> = ({ panel, isActive, onClick }) => {
	return (
		<button
			type="button"
			className={`sidebar-tab ${isActive ? "sidebar-tab--active" : ""}`}
			onClick={onClick}
			aria-label={panel.label}
			aria-selected={isActive}
			role="tab"
			title={panel.shortcut ? `${panel.label} (${panel.shortcut})` : panel.label}
		>
			{panel.icon && <span className="sidebar-tab__icon">{panel.icon}</span>}
			<span className="sidebar-tab__label">{panel.label}</span>
			{panel.badge !== undefined && <span className="sidebar-tab__badge">{panel.badge}</span>}
		</button>
	);
};
