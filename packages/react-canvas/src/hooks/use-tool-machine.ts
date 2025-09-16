import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { createSelectTool, getEffectTool } from "@usketch/tools";
import { useEffect, useRef, useState } from "react";
import { createActor } from "xstate";

export const useToolMachine = () => {
	const { currentTool } = useWhiteboardStore();
	const selectToolActorRef = useRef<any>(null);
	const [actorSnapshot, setActorSnapshot] = useState<any>(null);

	// Create select tool machine with Zustand store data as input
	useEffect(() => {
		// Create and start select tool actor when needed
		if (currentTool === "select" && !selectToolActorRef.current) {
			const selectToolMachine = createSelectTool();
			const actor = createActor(selectToolMachine);
			selectToolActorRef.current = actor;

			// Subscribe to actor state changes
			const subscription = actor.subscribe((snapshot) => {
				setActorSnapshot(snapshot);
			});

			actor.start();

			return () => {
				subscription.unsubscribe();
			};
		} else if (currentTool !== "select" && selectToolActorRef.current) {
			// Stop and cleanup when switching away from select tool
			selectToolActorRef.current.stop();
			selectToolActorRef.current = null;
			setActorSnapshot(null);
		}

		return () => {
			// Cleanup on unmount
			if (selectToolActorRef.current) {
				selectToolActorRef.current.stop();
				selectToolActorRef.current = null;
				setActorSnapshot(null);
			}
		};
	}, [currentTool]);

	// Get state from XState actor snapshot
	const dragState = actorSnapshot?.context?.dragState || null;
	const snapGuides = actorSnapshot?.context?.snapGuides || [];

	const sendEvent = (event: any) => {
		if (selectToolActorRef.current && currentTool === "select") {
			selectToolActorRef.current.send(event);
		}
	};

	const handlePointerDown = (point: Point & { shapeId?: string }, e: React.PointerEvent) => {
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
		dragState,
		snapGuides,
		isSelectTool: currentTool === "select",
		isEffectTool: currentTool === "effect",
	};
};
