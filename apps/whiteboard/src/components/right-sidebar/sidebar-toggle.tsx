import type React from "react";

interface SidebarToggleProps {
	isOpen: boolean;
	onToggle: () => void;
}

/**
 * Sidebar Toggle Button Component
 *
 * Button to open/close the sidebar.
 * Shows appropriate icon based on current state.
 */
export const SidebarToggle: React.FC<SidebarToggleProps> = ({ isOpen, onToggle }) => {
	return (
		<button
			type="button"
			className="sidebar-toggle"
			onClick={onToggle}
			aria-label={isOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
			aria-expanded={isOpen}
			title={isOpen ? "サイドバーを閉じる (Cmd+\\)" : "サイドバーを開く (Cmd+\\)"}
		>
			{isOpen ? "◀" : "▶"}
		</button>
	);
};
