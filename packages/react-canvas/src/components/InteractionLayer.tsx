import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { InteractionLayerProps } from "../types";

interface DragState {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	isDragging: boolean;
}

export const InteractionLayer: React.FC<InteractionLayerProps> = ({
	camera,
	activeTool,
	className = "",
}) => {
	const [dragState, setDragState] = useState<DragState>({
		startX: 0,
		startY: 0,
		currentX: 0,
		currentY: 0,
		isDragging: false,
	});

	const [drawPath, setDrawPath] = useState<string>("");
	const pathRef = useRef<string[]>([]);

	const { addShape, clearSelection } = useWhiteboardStore();

	const screenToCanvas = useCallback(
		(screenX: number, screenY: number) => {
			return {
				x: (screenX - camera.x) / camera.zoom,
				y: (screenY - camera.y) / camera.zoom,
			};
		},
		[camera],
	);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			const rect = e.currentTarget.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const { x, y } = screenToCanvas(screenX, screenY);

			if (activeTool === "select") {
				setDragState({
					startX: x,
					startY: y,
					currentX: x,
					currentY: y,
					isDragging: true,
				});
				if (!e.shiftKey && !e.metaKey) {
					clearSelection();
				}
			} else if (activeTool === "rectangle") {
				setDragState({
					startX: x,
					startY: y,
					currentX: x,
					currentY: y,
					isDragging: true,
				});
			} else if (activeTool === "draw") {
				pathRef.current = [`M ${x} ${y}`];
				setDrawPath(`M ${x} ${y}`);
				setDragState({ ...dragState, isDragging: true });
			}

			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[activeTool, camera, clearSelection, dragState.isDragging],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!dragState.isDragging) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const { x, y } = screenToCanvas(screenX, screenY);

			if (activeTool === "select" || activeTool === "rectangle") {
				setDragState((prev) => ({
					...prev,
					currentX: x,
					currentY: y,
				}));
			} else if (activeTool === "draw") {
				pathRef.current.push(`L ${x} ${y}`);
				setDrawPath(pathRef.current.join(" "));
			}
		},
		[activeTool, camera, dragState.isDragging],
	);

	const calculatePathBounds = useCallback((pathCommands: string[]) => {
		let minX = Infinity,
			minY = Infinity;
		let maxX = -Infinity,
			maxY = -Infinity;

		pathCommands.forEach((cmd) => {
			const matches = cmd.match(/[\d.-]+/g);
			if (matches && matches.length >= 2) {
				const x = parseFloat(matches[0]);
				const y = parseFloat(matches[1]);
				minX = Math.min(minX, x);
				minY = Math.min(minY, y);
				maxX = Math.max(maxX, x);
				maxY = Math.max(maxY, y);
			}
		});

		return {
			minX,
			minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}, []);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!dragState.isDragging) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const { x, y } = screenToCanvas(screenX, screenY);

			if (activeTool === "rectangle") {
				const minX = Math.min(dragState.startX, x);
				const minY = Math.min(dragState.startY, y);
				const width = Math.abs(x - dragState.startX);
				const height = Math.abs(y - dragState.startY);

				if (width > 5 && height > 5) {
					addShape({
						id: uuidv4(),
						type: "rectangle",
						x: minX,
						y: minY,
						width,
						height,
						fillColor: "rgba(100, 100, 250, 0.3)",
						strokeColor: "#000000",
						strokeWidth: 2,
						opacity: 1,
						rotation: 0,
					});
				}
			} else if (activeTool === "draw" && drawPath) {
				const bounds = calculatePathBounds(pathRef.current);
				if (bounds.width > 5 || bounds.height > 5) {
					addShape({
						id: uuidv4(),
						type: "freedraw",
						x: bounds.minX,
						y: bounds.minY,
						width: bounds.width,
						height: bounds.height,
						path: drawPath,
						points: [],
						strokeColor: "#000000",
						strokeWidth: 2,
						fillColor: "transparent",
						opacity: 1,
						rotation: 0,
					});
				}
				pathRef.current = [];
				setDrawPath("");
			}

			setDragState({
				startX: 0,
				startY: 0,
				currentX: 0,
				currentY: 0,
				isDragging: false,
			});

			e.currentTarget.releasePointerCapture(e.pointerId);
		},
		[activeTool, camera, dragState, drawPath, addShape, calculatePathBounds],
	);

	const getCursor = () => {
		switch (activeTool) {
			case "select":
				return "default";
			case "rectangle":
				return "crosshair";
			case "draw":
				return "crosshair";
			default:
				return "default";
		}
	};

	return (
		<div
			className={`interaction-layer ${className}`.trim()}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				cursor: getCursor(),
			}}
			data-active-tool={activeTool}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		>
			{dragState.isDragging && (
				<svg
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						pointerEvents: "none",
					}}
					role="img"
					aria-label="Drawing preview"
				>
					<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
						{activeTool === "select" && (
							<rect
								x={Math.min(dragState.startX, dragState.currentX)}
								y={Math.min(dragState.startY, dragState.currentY)}
								width={Math.abs(dragState.currentX - dragState.startX)}
								height={Math.abs(dragState.currentY - dragState.startY)}
								fill="rgba(0, 122, 255, 0.1)"
								stroke="#007AFF"
								strokeWidth={1}
								strokeDasharray="5,5"
							/>
						)}
						{activeTool === "rectangle" && (
							<rect
								x={Math.min(dragState.startX, dragState.currentX)}
								y={Math.min(dragState.startY, dragState.currentY)}
								width={Math.abs(dragState.currentX - dragState.startX)}
								height={Math.abs(dragState.currentY - dragState.startY)}
								fill="rgba(100, 100, 250, 0.3)"
								stroke="#000000"
								strokeWidth={2}
							/>
						)}
						{activeTool === "draw" && drawPath && (
							<path
								d={drawPath}
								fill="none"
								stroke="#000000"
								strokeWidth={2}
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						)}
					</g>
				</svg>
			)}
		</div>
	);
};
