import { useWhiteboardStore } from "@usketch/store";
import { useEffect } from "react";

export function useSelectionIndicator(activeTool: string | undefined) {
	// Get selection indicator state directly from Zustand store
	const selectionIndicator = useWhiteboardStore((state) => state.selectionIndicator);
	const hideSelectionIndicator = useWhiteboardStore((state) => state.hideSelectionIndicator);

	useEffect(() => {
		// Hide selection indicator when tool is not select
		if (activeTool !== "select") {
			hideSelectionIndicator();
		}
	}, [activeTool, hideSelectionIndicator]);

	// Return the selection indicator state if select tool is active
	if (activeTool !== "select") {
		return {
			bounds: null,
			visible: false,
			selectedCount: 0,
		};
	}

	return selectionIndicator;
}
