import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useCallback, useRef, useState } from "react";
import { useToolMachine } from "./use-tool-machine";

interface InteractionResult {
	cursor: string;
	activeTool: string;
	getCanvasProps: () => {
		onPointerDown: (e: React.PointerEvent) => void;
		onPointerMove: (e: React.PointerEvent) => void;
		onPointerUp: (e: React.PointerEvent) => void;
		onWheel: (e: React.WheelEvent) => void;
	};
}

export const useInteraction = (): InteractionResult => {
	const { currentTool, camera, setCamera } = useWhiteboardStore();
	const activeTool = currentTool || "select";
	const [cursor, setCursor] = useState("default");
	const [isPanning, setIsPanning] = useState(false);
	const panStartRef = useRef<Point | null>(null);
	const cameraPosRef = useRef<Point | null>(null);
	const toolMachine = useToolMachine();

	const getCanvasPoint = useCallback(
		(e: React.PointerEvent): Point => {
			const rect = e.currentTarget.getBoundingClientRect();
			return {
				x: (e.clientX - rect.left - camera.x) / camera.zoom,
				y: (e.clientY - rect.top - camera.y) / camera.zoom,
			};
		},
		[camera],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			// Middle mouse button or space + left click for panning
			if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
				setIsPanning(true);
				panStartRef.current = { x: e.clientX, y: e.clientY };
				cameraPosRef.current = { x: camera.x, y: camera.y };
				setCursor("grabbing");
				e.preventDefault();
				return;
			}

			// Left click for tool interaction
			if (e.button === 0 && activeTool) {
				const point = getCanvasPoint(e);

				// Handle select tool interactions
				if (toolMachine.isSelectTool) {
					toolMachine.handlePointerDown(point, e);
				} else {
					// Other tools handling
				}
			}
		},
		[camera, getCanvasPoint, activeTool, toolMachine],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (isPanning && panStartRef.current && cameraPosRef.current) {
				const dx = e.clientX - panStartRef.current.x;
				const dy = e.clientY - panStartRef.current.y;

				setCamera({
					x: cameraPosRef.current.x + dx,
					y: cameraPosRef.current.y + dy,
				});
			} else {
				const point = getCanvasPoint(e);

				// Handle select tool interactions
				if (toolMachine.isSelectTool) {
					toolMachine.handlePointerMove(point, e);
				}

				// Update cursor based on tool
				if (activeTool === "select") {
					setCursor("default");
				} else if (activeTool === "pan") {
					setCursor("grab");
				} else {
					setCursor("crosshair");
				}
			}
		},
		[isPanning, setCamera, activeTool, getCanvasPoint, toolMachine],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (isPanning) {
				setIsPanning(false);
				panStartRef.current = null;
				cameraPosRef.current = null;
				setCursor("default");
			} else {
				const point = getCanvasPoint(e);

				// Handle select tool interactions
				if (toolMachine.isSelectTool) {
					toolMachine.handlePointerUp(point, e);
				}
			}
		},
		[isPanning, getCanvasPoint, toolMachine],
	);

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();

			const zoomSpeed = 0.1;
			const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
			const newZoom = Math.max(0.1, Math.min(5, camera.zoom * (1 + delta)));

			// Calculate zoom center point
			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			// Adjust camera position to zoom towards mouse position
			const scale = newZoom / camera.zoom;
			const newX = x - (x - camera.x) * scale;
			const newY = y - (y - camera.y) * scale;

			setCamera({
				zoom: newZoom,
				x: newX,
				y: newY,
			});
		},
		[camera, setCamera],
	);

	return {
		cursor,
		activeTool,
		getCanvasProps: () => ({
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onWheel: handleWheel,
		}),
	};
};
