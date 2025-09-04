import type { Point } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useCallback, useRef, useState } from "react";

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
	const { activeTool, camera, setCamera } = useWhiteboardStore();
	const [cursor, setCursor] = useState("default");
	const [isPanning, setIsPanning] = useState(false);
	const panStartRef = useRef<Point | null>(null);
	const cameraPosRef = useRef<Point | null>(null);

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
				// Tool handling will be implemented in Phase 3
				console.log("Tool interaction at:", point);
			}
		},
		[activeTool, camera, getCanvasPoint],
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
		[isPanning, setCamera, activeTool],
	);

	const handlePointerUp = useCallback(() => {
		if (isPanning) {
			setIsPanning(false);
			panStartRef.current = null;
			cameraPosRef.current = null;
			setCursor("default");
		}
	}, [isPanning]);

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
