import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToolMachine } from "./use-tool-machine";

interface InteractionResult {
	cursor: string;
	currentTool: string;
	getCanvasProps: () => {
		onPointerDown: (e: React.PointerEvent) => void;
		onPointerMove: (e: React.PointerEvent) => void;
		onPointerUp: (e: React.PointerEvent) => void;
		onWheel: (e: React.WheelEvent) => void;
	};
}

export const useInteraction = (): InteractionResult => {
	const { currentTool, camera, setCamera } = useWhiteboardStore();
	const tool = currentTool || "select";
	const [cursor, setCursor] = useState("default");
	const toolMachine = useToolMachine();
	const cameraRef = useRef(camera);

	// Keep camera ref in sync
	cameraRef.current = camera;

	// Update cursor when pan cursor changes
	useEffect(() => {
		if (tool === "pan") {
			setCursor(toolMachine.panCursor);
		}
	}, [tool, toolMachine.panCursor]);

	const getCanvasPoint = useCallback((e: React.PointerEvent): Point => {
		const rect = e.currentTarget.getBoundingClientRect();
		const cam = cameraRef.current;
		return {
			x: (e.clientX - rect.left - cam.x) / cam.zoom,
			y: (e.clientY - rect.top - cam.y) / cam.zoom,
		};
	}, []);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			// Left click for tool interaction
			if (e.button === 0 && tool) {
				// Pan tool uses screen coordinates, others use canvas coordinates
				const point = toolMachine.isPanTool ? { x: e.clientX, y: e.clientY } : getCanvasPoint(e);

				// Handle tool interactions
				if (toolMachine.isSelectTool || toolMachine.isEffectTool || toolMachine.isPanTool) {
					toolMachine.handlePointerDown(point, e);
				}
			}
		},
		[getCanvasPoint, tool, toolMachine],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			// Pan tool uses screen coordinates, others use canvas coordinates
			const point = toolMachine.isPanTool ? { x: e.clientX, y: e.clientY } : getCanvasPoint(e);

			// Handle tool interactions
			if (toolMachine.isSelectTool || toolMachine.isPanTool) {
				toolMachine.handlePointerMove(point, e);
			}

			// Update cursor based on tool
			if (tool === "select") {
				setCursor("default");
			} else if (tool === "pan") {
				setCursor(toolMachine.panCursor);
			} else if (tool === "effect") {
				setCursor("crosshair");
			} else {
				setCursor("crosshair");
			}
		},
		[tool, getCanvasPoint, toolMachine, toolMachine.panCursor],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			// Pan tool uses screen coordinates, others use canvas coordinates
			const point = toolMachine.isPanTool ? { x: e.clientX, y: e.clientY } : getCanvasPoint(e);

			// Handle tool interactions
			if (toolMachine.isSelectTool || toolMachine.isPanTool) {
				toolMachine.handlePointerUp(point, e);
			}
		},
		[getCanvasPoint, toolMachine],
	);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();

			const cam = cameraRef.current;
			const zoomSpeed = 0.1;
			const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
			const newZoom = Math.max(0.1, Math.min(5, cam.zoom * (1 + delta)));

			// Calculate zoom center point
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			// Adjust camera position to zoom towards mouse position
			const scale = newZoom / cam.zoom;
			const newX = x - (x - cam.x) * scale;
			const newY = y - (y - cam.y) * scale;

			setCamera({
				zoom: newZoom,
				x: newX,
				y: newY,
			});
		},
		[setCamera],
	);

	return {
		cursor,
		currentTool: tool,
		getCanvasProps: () => ({
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onWheel: handleWheel,
		}),
	};
};
