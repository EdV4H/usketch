import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnyStateMachine } from "xstate";
import { createActor } from "xstate";
import { ToolManager } from "../adapters/toolManagerAdapter";
import { drawingToolMachine } from "../machines/drawingTool";
import { selectToolMachine } from "../machines/selectTool";
import { screenToWorld } from "../utils/geometry";

// === XState v5 React Hook ===
export function useToolMachine(toolId: string) {
	// v5: useMachine → useActor with createActor
	const toolMachine = useMemo<AnyStateMachine>(() => {
		switch (toolId) {
			case "select":
				return selectToolMachine;
			case "draw":
				return drawingToolMachine;
			default:
				throw new Error(`Unknown tool: ${toolId}`);
		}
	}, [toolId]);

	const toolActor = useMemo(() => {
		const actor = createActor(toolMachine);
		actor.start();
		return actor;
	}, [toolMachine]);

	// Use the actor directly, not wrapped in useActor
	const state = toolActor.getSnapshot();
	const send = toolActor.send;

	const handlers = useCallback(
		() => ({
			onPointerDown: (e: PointerEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY });
				send({
					type: "POINTER_DOWN",
					point,
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
					altKey: e.altKey,
				});
			},

			onPointerMove: (e: PointerEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY });
				send({ type: "POINTER_MOVE", point });
			},

			onPointerUp: (e: PointerEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY });
				send({ type: "POINTER_UP", point });
			},

			onKeyDown: (e: KeyboardEvent) => {
				if (e.key === "Escape") {
					send({ type: "ESCAPE" });
				} else if (e.key === "Delete" || e.key === "Backspace") {
					send({ type: "DELETE" });
				} else if (e.key === "Enter") {
					send({ type: "ENTER" });
				} else {
					send({ type: "KEY_DOWN", key: e.key });
				}
			},

			onDoubleClick: (e: MouseEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY });
				send({ type: "DOUBLE_CLICK", point });
			},
		}),
		[send],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			toolActor.stop();
		};
	}, [toolActor]);

	return {
		state: state.value,
		context: state.context,
		send,
		handlers: handlers(),
		isIn: (stateValue: string) => state.matches(stateValue),
		actor: toolActor,
	};
}

// === Hook for Tool Manager ===
export function useToolManager() {
	const [currentTool, setCurrentTool] = useState("select");
	const toolManagerRef = useRef<ToolManager | null>(null);

	useEffect(() => {
		if (!toolManagerRef.current) {
			toolManagerRef.current = new ToolManager();
		}

		const manager = toolManagerRef.current;
		manager.setActiveTool(currentTool);

		return () => {
			// Cleanup if needed
		};
	}, [currentTool]);

	const switchTool = useCallback((toolId: string) => {
		setCurrentTool(toolId);
		toolManagerRef.current?.setActiveTool(toolId);
	}, []);

	const sendToTool = useCallback(() => {
		// The new ToolManager handles events through specific methods
		// This method is not used in the new implementation
		console.warn("sendToTool is deprecated in the new ToolManager");
	}, []);

	return {
		currentTool,
		switchTool,
		sendToTool,
		toolManager: toolManagerRef.current,
	};
}
