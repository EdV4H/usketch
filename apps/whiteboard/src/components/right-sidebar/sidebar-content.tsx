import type React from "react";
import type { ReactNode } from "react";

interface SidebarContentProps {
	children: ReactNode;
}

/**
 * Sidebar Content Component
 *
 * Container for the active panel's content.
 * Provides consistent padding and scrolling behavior.
 */
export const SidebarContent: React.FC<SidebarContentProps> = ({ children }) => {
	return <div className="sidebar-content">{children}</div>;
};
