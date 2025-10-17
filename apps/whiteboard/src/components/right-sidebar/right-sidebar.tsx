import type React from "react";
import { useSidebar } from "../../sidebar";
import { SidebarContent } from "./sidebar-content";
import { SidebarTabs } from "./sidebar-tabs";
import { SidebarToggle } from "./sidebar-toggle";
import "./right-sidebar.css";

/**
 * Right Sidebar Component
 *
 * Main sidebar component that displays panels in a tab-based interface.
 * Integrates with SidebarProvider for state management.
 *
 * Features:
 * - Tab-based panel switching
 * - Collapsible sidebar
 * - Smooth animations
 * - Keyboard shortcuts support (via parent)
 *
 * @example
 * ```tsx
 * <SidebarProvider>
 *   <RightSidebar />
 * </SidebarProvider>
 * ```
 */
export const RightSidebar: React.FC = () => {
	const { panels, activeTab, setActiveTab, isOpen, toggleSidebar } = useSidebar();

	const activePanel = panels.find((p) => p.id === activeTab);

	return (
		<div className={`right-sidebar ${isOpen ? "right-sidebar--open" : "right-sidebar--closed"}`}>
			{panels.length > 0 && (
				<>
					<SidebarTabs panels={panels} activeTab={activeTab} onTabChange={setActiveTab} />
					{isOpen && <SidebarContent>{activePanel?.content}</SidebarContent>}
				</>
			)}
			<SidebarToggle isOpen={isOpen} onToggle={toggleSidebar} />
		</div>
	);
};
