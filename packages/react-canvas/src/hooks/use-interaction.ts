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

	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			// ctrlKey + wheelはピンチズーム（ズーム操作）
			const isPinchZoom = e.ctrlKey;

			// Shift+Wheelは水平スクロールとして扱う
			if (e.shiftKey && !isPinchZoom) {
				e.preventDefault();
				// Shift+Wheelの場合、ブラウザによってdeltaXまたはdeltaYに値が入る
				// どちらか値がある方を使う
				const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
				const scrollAmount = delta * 0.5;
				const newX = camera.x - scrollAmount / camera.zoom;
				setCamera({
					x: newX,
				});
				return;
			}

			// ピンチズームでない場合、deltaXがあれば二本指パン（マウスホイールはdeltaXが0）
			if (!isPinchZoom && e.deltaX !== 0) {
				e.preventDefault();
				const scrollAmountX = e.deltaX * 0.5;
				const scrollAmountY = e.deltaY * 0.5;
				setCamera({
					x: camera.x - scrollAmountX / camera.zoom,
					y: camera.y - scrollAmountY / camera.zoom,
				});
				return;
			}

			// ctrlKeyなしでdeltaYのみ（垂直方向）の場合も二本指パンの可能性
			// マウスホイールと区別するため、deltaYが小さい場合は二本指パンと判定
			if (!isPinchZoom && e.deltaX === 0 && Math.abs(e.deltaY) < 50) {
				e.preventDefault();
				const scrollAmountY = e.deltaY * 0.5;
				setCamera({
					y: camera.y - scrollAmountY / camera.zoom,
				});
				return;
			}

			// ピンチズームまたはマウスホイールによるズーム
			e.preventDefault();

			// ピンチズームの場合は感度を下げる
			const zoomSpeed = isPinchZoom ? 0.05 : 0.1;
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
		currentTool: tool,
		getCanvasProps: () => ({
			onPointerDown: handlePointerDown,
			onPointerMove: handlePointerMove,
			onPointerUp: handlePointerUp,
			onWheel: handleWheel,
		}),
	};
};
