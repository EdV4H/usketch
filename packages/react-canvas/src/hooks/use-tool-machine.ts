import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { createSelectTool } from "@usketch/tools/machines/select-tool";
import { useEffect, useRef } from "react";
import { createActor } from "xstate";

export const useToolMachine = () => {
	const { currentTool } = useWhiteboardStore();
	const selectToolActorRef = useRef<any>(null);

	useEffect(() => {
		// Create Select Tool machine actor
		if (currentTool === "select" && !selectToolActorRef.current) {
			const selectToolMachine = createSelectTool();
			selectToolActorRef.current = createActor(selectToolMachine);
			selectToolActorRef.current.start();
		}

		// Cleanup on unmount or tool change
		return () => {
			if (selectToolActorRef.current) {
				selectToolActorRef.current.stop();
				selectToolActorRef.current = null;
			}
		};
	}, [currentTool]);

	const sendEvent = (event: any) => {
		if (selectToolActorRef.current) {
			selectToolActorRef.current.send(event);
		}
	};

	const handlePointerDown = (point: Point, e: React.PointerEvent) => {
		if (currentTool === "select") {
			// Check if we're clicking on a resize handle
			const target = e.target as HTMLElement;
			const resizeHandle = target.getAttribute("data-resize-handle");

			console.log("Pointer down - target:", target, "resizeHandle:", resizeHandle);
			console.log("Target className:", target.className);
			console.log("Point:", point);

			sendEvent({
				type: "POINTER_DOWN",
				point,
				target: resizeHandle || undefined,
				shiftKey: e.shiftKey,
				ctrlKey: e.ctrlKey,
				metaKey: e.metaKey,
			});
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
		isSelectTool: currentTool === "select",
	};
};
