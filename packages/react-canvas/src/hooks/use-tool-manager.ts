import { useEffectRegistry } from "@usketch/effect-registry";
import type { Point, Shape } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { createDefaultToolManager, type ToolManager } from "@usketch/tools";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook to integrate ToolManager with React
 * Provides a bridge between XState-based ToolManager and React components
 */
export const useToolManager = () => {
	const toolManagerRef = useRef<ToolManager | null>(null);
	const { currentTool, setCurrentTool } = useWhiteboardStore();
	const [previewShape, setPreviewShape] = useState<Shape | null>(null);
	const effectRegistry = useEffectRegistry();

	// Initialize ToolManager once
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Initialize only once

	// Set the effect registry whenever it changes or tool manager is ready
	useEffect(() => {
		if (!toolManagerRef.current || !effectRegistry) return;

		// Access private toolManagerActor to send registry to effect tool
		// This is a temporary solution until ToolManager provides a public API
		const toolManagerInternal = toolManagerRef.current as unknown as {
			toolManagerActor?: {
				getSnapshot: () => {
					children?: Record<string, { send: (event: unknown) => void }>;
				};
			};
		};

		if (toolManagerInternal.toolManagerActor) {
			const snapshot = toolManagerInternal.toolManagerActor.getSnapshot();
			const effectToolActor = snapshot.children?.effect;
			if (effectToolActor) {
				effectToolActor.send({ type: "SET_REGISTRY", registry: effectRegistry });
			}
		}
	}, [effectRegistry, toolManagerRef.current]); // Update when registry or toolManager changes

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

			// Update preview shape
			const preview = toolManagerRef.current.getPreviewShape();
			setPreviewShape(preview);
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

	return {
		toolManager: toolManagerRef.current,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleKeyDown,
		handleKeyUp,
		setActiveTool,
		getPreviewShape: () => previewShape,
	};
};
