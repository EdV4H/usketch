import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { getEffectTool } from "@usketch/tools";
import { useEffect } from "react";
import { toolMachineSingleton } from "./tool-machine-singleton";

export const useToolMachine = () => {
	const { currentTool } = useWhiteboardStore();

	useEffect(() => {
		// Update the singleton with current tool
		toolMachineSingleton.setCurrentTool(currentTool);

		// Cleanup on unmount
		return () => {
			// Don't cleanup here as other components might still be using it
		};
	}, [currentTool]);

	const sendEvent = (event: any) => {
		toolMachineSingleton.sendEvent(event);
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
