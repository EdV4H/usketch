import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useCallback, useRef } from "react";
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

/**
 * @deprecated This hook is deprecated. Use useToolManager instead for better architecture.
 * This hook remains for backward compatibility but should not be used in new code.
 */
export const useInteraction = (): InteractionResult => {
	const { currentTool, camera, setCamera } = useWhiteboardStore();
	const tool = currentTool || "select";
	const toolMachine = useToolMachine();
	const cameraRef = useRef(camera);

	// Keep camera ref in sync
	cameraRef.current = camera;

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
			if (e.button === 0 && tool) {
				const point = getCanvasPoint(e);
				if (toolMachine.isSelectTool || toolMachine.isEffectTool) {
					toolMachine.handlePointerDown(point, e);
				}
			}
		},
		[getCanvasPoint, tool, toolMachine],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			const point = getCanvasPoint(e);
			if (toolMachine.isSelectTool) {
				toolMachine.handlePointerMove(point, e);
			}
		},
		[getCanvasPoint, toolMachine],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			const point = getCanvasPoint(e);
			if (toolMachine.isSelectTool) {
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

			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

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

	const getCursor = () => {
		switch (tool) {
			case "select":
				return "default";
			case "pan":
				return "grab";
			case "effect":
				return "crosshair";
			default:
				return "crosshair";
		}
	};

	return {
		cursor: getCursor(),
		currentTool: tool,
		getCanvasProps: () => ({
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onWheel: handleWheel,
		}),
	};
};
