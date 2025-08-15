import type { Point } from "@usketch/shared-types";
import { useActor, useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getToolManager } from "../machines/tool-manager-machine";
import type { KeyboardToolEvent, PointerToolEvent, ToolEvent } from "../machines/types";

// === Screen to World coordinate conversion ===
function screenToWorld(screenPoint: Point, viewport?: { zoom: number; pan: Point }): Point {
	const zoom = viewport?.zoom ?? 1;
	const pan = viewport?.pan ?? { x: 0, y: 0 };

	return {
		x: (screenPoint.x - pan.x) / zoom,
		y: (screenPoint.y - pan.y) / zoom,
	};
}

// === Main Hook for Tool Machine ===
export function useToolMachine(viewport?: { zoom: number; pan: Point }) {
	const toolManager = useMemo(() => getToolManager(), []);
	const [state, send] = useActor(toolManager.getService());

	// Event handlers
	const handlers = useMemo(
		() => ({
			onPointerDown: (e: PointerEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewport);
				const event: PointerToolEvent = {
					type: "POINTER_DOWN",
					point,
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					metaKey: e.metaKey,
					pressure: e.pressure || 1,
				};
				toolManager.send(event);
			},

			onPointerMove: (e: PointerEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewport);
				const event: PointerToolEvent = {
					type: "POINTER_MOVE",
					point,
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					metaKey: e.metaKey,
					pressure: e.pressure || 1,
				};
				toolManager.send(event);
			},

			onPointerUp: (e: PointerEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewport);
				const event: PointerToolEvent = {
					type: "POINTER_UP",
					point,
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					metaKey: e.metaKey,
				};
				toolManager.send(event);
			},

			onKeyDown: (e: KeyboardEvent) => {
				// Handle common keyboard shortcuts
				if (e.key === "Escape") {
					toolManager.send({ type: "ESCAPE" });
				} else if ((e.key === "Delete" || e.key === "Backspace") && !e.target) {
					toolManager.send({ type: "DELETE" });
				} else if (e.key === "Enter") {
					toolManager.send({ type: "ENTER" });
				} else {
					const event: KeyboardToolEvent = {
						type: "KEY_DOWN",
						key: e.key,
						code: e.code,
						shiftKey: e.shiftKey,
						ctrlKey: e.ctrlKey,
						altKey: e.altKey,
						metaKey: e.metaKey,
					};
					toolManager.send(event);
				}
			},

			onKeyUp: (e: KeyboardEvent) => {
				const event: KeyboardToolEvent = {
					type: "KEY_UP",
					key: e.key,
					code: e.code,
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					metaKey: e.metaKey,
				};
				toolManager.send(event);
			},

			onWheel: (e: WheelEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewport);
				toolManager.send({
					type: "WHEEL",
					delta: { x: e.deltaX, y: e.deltaY },
					point,
					shiftKey: e.shiftKey,
					ctrlKey: e.ctrlKey,
					altKey: e.altKey,
					metaKey: e.metaKey,
				});
			},

			onDoubleClick: (e: MouseEvent) => {
				const point = screenToWorld({ x: e.clientX, y: e.clientY }, viewport);
				toolManager.send({
					type: "DOUBLE_CLICK",
					point,
				});
			},
		}),
		[toolManager, viewport],
	);

	// Tool switching
	const switchTool = useCallback(
		(toolId: string) => {
			toolManager.activate(toolId);
		},
		[toolManager],
	);

	// Get current tool info
	const currentToolId = state.context.currentToolId;
	const availableTools = Array.from(state.context.availableTools.values());
	const isActive = state.matches("active");

	// Get tool-specific context if available
	const currentToolActor = state.context.currentToolActor;
	const toolState = currentToolActor?.getSnapshot?.();
	const toolContext = toolState?.context;

	return {
		// State
		currentToolId,
		availableTools,
		isActive,
		toolState,
		toolContext,

		// Actions
		switchTool,
		send: toolManager.send.bind(toolManager),

		// Event handlers
		handlers,

		// Tool Manager instance (for advanced usage)
		toolManager,
	};
}

// === Hook for specific tool machines ===
export function useSpecificTool(toolId: string) {
	const toolManager = useMemo(() => getToolManager(), []);
	const [managerState] = useActor(toolManager.getService());

	// Get the specific tool actor
	const isCurrentTool = managerState.context.currentToolId === toolId;
	const toolActor = isCurrentTool ? managerState.context.currentToolActor : null;

	// Subscribe to tool state changes
	const [toolState, setToolState] = useState(toolActor?.getSnapshot?.());

	useEffect(() => {
		if (!toolActor) {
			setToolState(undefined);
			return;
		}

		const subscription = toolActor.subscribe((state: any) => {
			setToolState(state);
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [toolActor]);

	// Tool-specific actions
	const send = useCallback(
		(event: ToolEvent) => {
			if (isCurrentTool) {
				toolManager.send(event);
			}
		},
		[toolManager, isCurrentTool],
	);

	const activate = useCallback(() => {
		toolManager.activate(toolId);
	}, [toolManager, toolId]);

	return {
		isActive: isCurrentTool,
		state: toolState?.value,
		context: toolState?.context,
		send,
		activate,
		matches: (state: string) => toolState?.matches(state) ?? false,
	};
}

// === Hook for tool settings ===
export function useToolSettings() {
	const toolManager = useMemo(() => getToolManager(), []);
	const [state] = useActor(toolManager.getService());

	const settings = state.context.settings;

	const updateSettings = useCallback(
		(updates: Partial<typeof settings>) => {
			toolManager.updateSettings(updates);
		},
		[toolManager],
	);

	return {
		settings,
		updateSettings,
	};
}

// === Hook for tool history ===
export function useToolHistory() {
	const toolManager = useMemo(() => getToolManager(), []);
	const [state] = useActor(toolManager.getService());

	const history = state.context.toolHistory;
	const currentToolId = state.context.currentToolId;

	const goToPreviousTool = useCallback(() => {
		if (history.length > 1) {
			const previousTool = history[history.length - 2];
			toolManager.activate(previousTool);
		}
	}, [toolManager, history]);

	return {
		history,
		currentToolId,
		goToPreviousTool,
	};
}
