import { useEffect, useState } from "react";

interface SelectionIndicatorState {
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null;
	visible: boolean;
	selectedCount: number;
}

interface SelectionIndicatorEvent extends CustomEvent {
	detail: SelectionIndicatorState;
}

export function useSelectionIndicator(activeTool: string | undefined) {
	const [indicatorState, setIndicatorState] = useState<SelectionIndicatorState>({
		bounds: null,
		visible: false,
		selectedCount: 0,
	});

	useEffect(() => {
		if (activeTool !== "select") {
			setIndicatorState({ bounds: null, visible: false, selectedCount: 0 });
			return;
		}

		// ツールからのイベントをリッスン
		const handleSelectionUpdate = (event: Event) => {
			const customEvent = event as SelectionIndicatorEvent;
			const { bounds, visible, selectedCount } = customEvent.detail;
			setIndicatorState({ bounds, visible, selectedCount });
		};

		window.addEventListener("selection-indicator-update", handleSelectionUpdate);

		return () => {
			window.removeEventListener("selection-indicator-update", handleSelectionUpdate);
		};
	}, [activeTool]);

	return indicatorState;
}
