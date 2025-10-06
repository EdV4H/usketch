import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { createDefaultToolManager, type ToolManager } from "@usketch/tools";
import { useCallback, useEffect, useRef } from "react";

/**
 * Hook to integrate ToolManager with React
 * Provides a bridge between XState-based ToolManager and React components
 */
export const useToolManager = () => {
	const toolManagerRef = useRef<ToolManager | null>(null);
	const { currentTool, setCurrentTool } = useWhiteboardStore();

	// Initialize ToolManager
	useEffect(() => {
		if (!toolManagerRef.current) {
			toolManagerRef.current = createDefaultToolManager({
				defaultToolId: currentTool || "select",
				onToolChange: (toolId: string) => {
					// Sync ToolManager state with Zustand store
					setCurrentTool(toolId);
				},
			});
		}

		return () => {
			toolManagerRef.current?.destroy();
			toolManagerRef.current = null;
		};
	}, [currentTool, setCurrentTool]);

	// Sync currentTool from store to ToolManager
	useEffect(() => {
		if (toolManagerRef.current && currentTool) {
			const activeToolId = toolManagerRef.current.getActiveTool();
			if (activeToolId !== currentTool) {
				toolManagerRef.current.setActiveTool(currentTool, false); // Don't update store to avoid loop
			}
		}
	}, [currentTool]);

	// Screen to world coordinate conversion
	const screenToWorld = useCallback(
		(screenX: number, screenY: number, camera: { x: number; y: number; zoom: number }): Point => {
			return {
				x: (screenX - camera.x) / camera.zoom,
				y: (screenY - camera.y) / camera.zoom,
			};
		},
		[],
	);

	// Event handlers that forward to ToolManager
	const handlePointerDown = useCallback(
		(e: PointerEvent, camera: { x: number; y: number; zoom: number }) => {
			if (!toolManagerRef.current) return;

			const rect = (e.target as HTMLElement).getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const worldPos = screenToWorld(screenX, screenY, camera);

			toolManagerRef.current.handlePointerDown(e, worldPos);
		},
		[screenToWorld],
	);

	const handlePointerMove = useCallback(
		(e: PointerEvent, camera: { x: number; y: number; zoom: number }) => {
			if (!toolManagerRef.current) return;

			const rect = (e.target as HTMLElement).getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const worldPos = screenToWorld(screenX, screenY, camera);

			toolManagerRef.current.handlePointerMove(e, worldPos);
		},
		[screenToWorld],
	);

	const handlePointerUp = useCallback(
		(e: PointerEvent, camera: { x: number; y: number; zoom: number }) => {
			if (!toolManagerRef.current) return;

			const rect = (e.target as HTMLElement).getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const worldPos = screenToWorld(screenX, screenY, camera);

			toolManagerRef.current.handlePointerUp(e, worldPos);
		},
		[screenToWorld],
	);

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (!toolManagerRef.current) return;
		toolManagerRef.current.handleKeyDown(e);
	}, []);

	const handleKeyUp = useCallback((e: KeyboardEvent) => {
		if (!toolManagerRef.current) return;
		toolManagerRef.current.handleKeyUp(e);
	}, []);

	const setActiveTool = useCallback((toolId: string) => {
		if (!toolManagerRef.current) return;
		toolManagerRef.current.setActiveTool(toolId);
	}, []);

	const getPreviewShape = useCallback(() => {
		if (!toolManagerRef.current) return null;
		return toolManagerRef.current.getPreviewShape();
	}, []);

	return {
		toolManager: toolManagerRef.current,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleKeyDown,
		handleKeyUp,
		setActiveTool,
		getPreviewShape,
	};
};
