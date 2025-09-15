import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { getEffectTool } from "@usketch/tools";

export const useToolMachine = () => {
	const { currentTool } = useWhiteboardStore();

	const sendEvent = (event: any) => {
		// Event sending removed - alignment is now handled by Zustand actions
	};

	const handlePointerDown = (point: Point, e: React.PointerEvent) => {
		if (currentTool === "select") {
			// Check if we're clicking on a resize handle
			const target = e.target as HTMLElement;
			const resizeHandle = target.getAttribute("data-resize-handle");

			sendEvent({
				type: "POINTER_DOWN",
				point,
				target: resizeHandle || undefined,
				shiftKey: e.shiftKey,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
			});
		} else if (currentTool === "effect") {
			// Delegate to effect tool
			const effectTool = getEffectTool();
			effectTool.handlePointerDown(point);
		}
	};

	const handlePointerMove = (point: Point, e: React.PointerEvent) => {
		if (currentTool === "select") {
			sendEvent({
				type: "POINTER_MOVE",
				point,
				shiftKey: e.shiftKey,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
			});
		}
	};

	const handlePointerUp = (point: Point, e: React.PointerEvent) => {
		if (currentTool === "select") {
			sendEvent({
				type: "POINTER_UP",
				point,
				shiftKey: e.shiftKey,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
			});
		}
	};

	const handleKeyDown = (key: string) => {
		if (currentTool === "select") {
			if (key === "Escape") {
				sendEvent({ type: "ESCAPE" });
			} else if (key === "Delete" || key === "Backspace") {
				sendEvent({ type: "DELETE" });
			}
		}
	};

	return {
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleKeyDown,
		sendEvent,
		isSelectTool: currentTool === "select",
		isEffectTool: currentTool === "effect",
	};
};
