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
	const [isPanning, setIsPanning] = useState(false);
	const [isSpacePressed, setIsSpacePressed] = useState(false);
	const panStartRef = useRef<Point | null>(null);
	const cameraPosRef = useRef<Point | null>(null);
	const toolMachine = useToolMachine();

	// Handle Space key for panning
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space" && !e.repeat) {
				e.preventDefault();
				setIsSpacePressed(true);
				if (!isPanning) {
					setCursor("grab");
				}
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				e.preventDefault();
				setIsSpacePressed(false);
				if (!isPanning) {
					setCursor("default");
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [isPanning]);

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
			if (e.button === 1 || (e.button === 0 && (e.shiftKey || isSpacePressed))) {
				setIsPanning(true);
				panStartRef.current = { x: e.clientX, y: e.clientY };
				cameraPosRef.current = { x: camera.x, y: camera.y };
				setCursor("grabbing");
				e.preventDefault();
				return;
			}

			// Left click for tool interaction
			if (e.button === 0 && tool) {
				const point = getCanvasPoint(e);

				// Handle tool interactions
				if (toolMachine.isSelectTool || toolMachine.isEffectTool) {
					toolMachine.handlePointerDown(point, e);
				} else {
					// Other tools handling
				}
			}
		},
		[camera, isSpacePressed, getCanvasPoint, tool, toolMachine],
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
				if (tool === "select") {
					setCursor("default");
				} else if (tool === "pan") {
					setCursor("grab");
				} else if (tool === "effect") {
					setCursor("crosshair");
				} else {
					setCursor("crosshair");
				}
			}
		},
		[isPanning, setCamera, tool, getCanvasPoint, toolMachine],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (isPanning) {
				setIsPanning(false);
				panStartRef.current = null;
				cameraPosRef.current = null;
				setCursor(isSpacePressed ? "grab" : "default");
			} else {
				const point = getCanvasPoint(e);

				// Handle select tool interactions
				if (toolMachine.isSelectTool) {
					toolMachine.handlePointerUp(point, e);
				}
			}
		},
		[isPanning, isSpacePressed, getCanvasPoint, toolMachine],
	);

	const handleWheel = useCallback((e: React.WheelEvent) => {
		// Let the input manager handle wheel events
		// This is now handled by the camera-commands through the input system
		// We just need to prevent default browser behavior
		// e.preventDefault(); // This is handled in camera-commands
	}, []);

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
