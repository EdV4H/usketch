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
		onTouchStart: (e: React.TouchEvent) => void;
		onTouchMove: (e: React.TouchEvent) => void;
		onTouchEnd: (e: React.TouchEvent) => void;
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

	// Touch gesture state
	const touchPrevRef = useRef<{ x: number; y: number; distance: number } | null>(null);

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

	// Touch gesture helpers
	const getTouchCenter = useCallback((touches: React.TouchList): { x: number; y: number } => {
		if (touches.length === 1) {
			return { x: touches[0].clientX, y: touches[0].clientY };
		}
		const x = (touches[0].clientX + touches[1].clientX) / 2;
		const y = (touches[0].clientY + touches[1].clientY) / 2;
		return { x, y };
	}, []);

	const getTouchDistance = useCallback((touches: React.TouchList): number => {
		if (touches.length < 2) return 0;
		const dx = touches[1].clientX - touches[0].clientX;
		const dy = touches[1].clientY - touches[0].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}, []);

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

	// タッチジェスチャー専用ハンドラー
	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			if (e.touches.length === 2) {
				// 2本指ジェスチャー開始
				const center = getTouchCenter(e.touches);
				const distance = getTouchDistance(e.touches);
				touchPrevRef.current = { x: center.x, y: center.y, distance };
				e.preventDefault();
			}
		},
		[getTouchCenter, getTouchDistance],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			if (e.touches.length !== 2 || !touchPrevRef.current) return;

			const center = getTouchCenter(e.touches);
			const distance = getTouchDistance(e.touches);

			// 前フレームとの差分
			const distanceRatio = distance / touchPrevRef.current.distance;
			const dx = center.x - touchPrevRef.current.x;
			const dy = center.y - touchPrevRef.current.y;

			// ズームと パンを同時に適用
			const newZoom = Math.max(0.1, Math.min(5, camera.zoom * distanceRatio));

			setCamera({
				zoom: newZoom,
				x: camera.x + dx,
				y: camera.y + dy,
			});

			// 次フレーム用に保存
			touchPrevRef.current = { x: center.x, y: center.y, distance };

			e.preventDefault();
		},
		[camera, setCamera, getTouchCenter, getTouchDistance],
	);

	const handleTouchEnd = useCallback((e: React.TouchEvent) => {
		if (e.touches.length < 2) {
			touchPrevRef.current = null;
		}
	}, []);

	// マウスホイール専用ハンドラー（タッチイベントは別処理）
	const handleWheel = useCallback(
		(e: React.WheelEvent) => {
			e.preventDefault();

			// Shift+Wheel: 水平スクロール
			if (e.shiftKey) {
				const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
				const scrollAmount = delta * 0.5;
				setCamera({
					x: camera.x - scrollAmount / camera.zoom,
				});
				return;
			}

			// Ctrl+Wheel: ピンチズーム（感度低め）
			if (e.ctrlKey) {
				const zoomSpeed = 0.05;
				const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
				const newZoom = Math.max(0.1, Math.min(5, camera.zoom * (1 + delta)));

				const rect = e.currentTarget.getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;

				const scale = newZoom / camera.zoom;
				const newX = x - (x - camera.x) * scale;
				const newY = y - (y - camera.y) * scale;

				setCamera({
					zoom: newZoom,
					x: newX,
					y: newY,
				});
				return;
			}

			// 通常のホイール: ズーム
			const zoomSpeed = 0.1;
			const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
			const newZoom = Math.max(0.1, Math.min(5, camera.zoom * (1 + delta)));

			const rect = e.currentTarget.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

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
			onTouchStart: handleTouchStart,
			onTouchMove: handleTouchMove,
			onTouchEnd: handleTouchEnd,
		}),
	};
};
