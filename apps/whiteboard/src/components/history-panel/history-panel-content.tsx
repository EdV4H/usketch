import { HistoryDebugPanel } from "@usketch/ui-components";
import type React from "react";

/**
 * History Panel Content
 *
 * Wraps the HistoryDebugPanel from @usketch/ui-components for sidebar integration.
 * This component adapts the standalone panel to work within the sidebar layout.
 */
export const HistoryPanelContent: React.FC = () => {
	// Remove positioning styles since sidebar handles layout
	// The onClose handler is omitted since sidebar manages visibility
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				overflow: "auto",
			}}
		>
			<HistoryDebugPanel />
		</div>
	);
};
