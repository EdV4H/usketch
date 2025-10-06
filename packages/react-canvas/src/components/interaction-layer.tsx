import { DEFAULT_FREEDRAW_STYLES, DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useSelectionIndicator } from "../hooks/use-selection-indicator";
import type { InteractionLayerProps } from "../types";
import { DefaultSelectionIndicator } from "./default-selection-indicator";

interface DragState {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	isDragging: boolean;
}

export const InteractionLayer: React.FC<InteractionLayerProps> = ({
	camera,
	currentTool,
	selectionIndicator,
	selectionIndicatorClassName: _selectionIndicatorClassName,
	selectionIndicatorStyle: _selectionIndicatorStyle,
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

	const { addShape, setCurrentTool, setCamera, camera: storeCamera } = useWhiteboardStore();

	// Selection indicator state from hook
	const { bounds, visible, selectedCount } = useSelectionIndicator(currentTool);

	// Use custom indicator or default
	const SelectionIndicatorComponent = selectionIndicator || DefaultSelectionIndicator;

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

			if (currentTool === "pan") {
				// Pan tool: store screen coordinates and initial camera position
				setDragState({
					startX: screenX,
					startY: screenY,
					currentX: screenX,
					currentY: screenY,
					isDragging: true,
				});
			} else if (currentTool === "rectangle" || currentTool === "ellipse") {
				setDragState({
					startX: x,
					startY: y,
					currentX: x,
					currentY: y,
					isDragging: true,
				});
			} else if (currentTool === "draw") {
				pathRef.current = [`M ${x} ${y}`];
				setDrawPath(`M ${x} ${y}`);
				setDragState({ ...dragState, isDragging: true });
			}

			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[currentTool, screenToCanvas, dragState],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!dragState.isDragging) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const { x, y } = screenToCanvas(screenX, screenY);

			if (currentTool === "pan") {
				// Pan tool: update camera position based on drag delta
				const dx = screenX - dragState.startX;
				const dy = screenY - dragState.startY;

				setCamera({
					x: storeCamera.x + dx,
					y: storeCamera.y + dy,
				});

				// Update drag state to reflect new position
				setDragState((prev) => ({
					...prev,
					startX: screenX,
					startY: screenY,
				}));
			} else if (currentTool === "rectangle" || currentTool === "ellipse") {
				setDragState((prev) => ({
					...prev,
					currentX: x,
					currentY: y,
				}));
			} else if (currentTool === "draw") {
				pathRef.current.push(`L ${x} ${y}`);
				setDrawPath(pathRef.current.join(" "));
			}
		},
		[
			currentTool,
			screenToCanvas,
			dragState.isDragging,
			dragState.startX,
			dragState.startY,
			setCamera,
			storeCamera,
		],
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

			if (currentTool === "rectangle" || currentTool === "ellipse") {
				const minX = Math.min(dragState.startX, x);
				const minY = Math.min(dragState.startY, y);
				const width = Math.abs(x - dragState.startX);
				const height = Math.abs(y - dragState.startY);

				if (width > 5 && height > 5) {
					addShape({
						id: uuidv4(),
						type: currentTool === "ellipse" ? "ellipse" : "rectangle",
						x: minX,
						y: minY,
						width,
						height,
						fillColor: DEFAULT_SHAPE_STYLES.fillColor,
						strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
						strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
						opacity: DEFAULT_SHAPE_STYLES.opacity,
						rotation: 0,
					});
				}
			} else if (currentTool === "draw" && drawPath) {
				const bounds = calculatePathBounds(pathRef.current);
				if (bounds.width > 5 || bounds.height > 5) {
					// Extract points from path commands
					const points = pathRef.current
						.map((cmd) => {
							const matches = cmd.match(/[\d.-]+/g);
							if (matches && matches.length >= 2) {
								return {
									x: parseFloat(matches[0]),
									y: parseFloat(matches[1]),
								};
							}
							return null;
						})
						.filter((p): p is { x: number; y: number } => p !== null);

					addShape({
						id: uuidv4(),
						type: "freedraw",
						x: bounds.minX,
						y: bounds.minY,
						width: bounds.width,
						height: bounds.height,
						path: drawPath,
						points: points, // Set the extracted points
						strokeColor: DEFAULT_FREEDRAW_STYLES.strokeColor,
						strokeWidth: DEFAULT_FREEDRAW_STYLES.strokeWidth,
						fillColor: DEFAULT_FREEDRAW_STYLES.fillColor,
						opacity: DEFAULT_FREEDRAW_STYLES.opacity,
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
		[currentTool, screenToCanvas, dragState, drawPath, addShape, calculatePathBounds],
	);

	// Handle escape key to cancel drawing
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && dragState.isDragging) {
				e.preventDefault();
				// Cancel current drawing
				setDragState({
					startX: 0,
					startY: 0,
					currentX: 0,
					currentY: 0,
					isDragging: false,
				});
				pathRef.current = [];
				setDrawPath("");
				// Switch back to select tool
				setCurrentTool("select");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [dragState.isDragging, setCurrentTool]);

	const getCursor = () => {
		switch (currentTool) {
			case "select":
				return "default";
			case "pan":
				return dragState.isDragging ? "grabbing" : "grab";
			case "rectangle":
			case "ellipse":
			case "draw":
				return "crosshair";
			default:
				return "default";
		}
	};

	// Render selection indicator for select tool
	if (currentTool === "select") {
		return (
			<SelectionIndicatorComponent
				bounds={bounds}
				visible={visible}
				camera={camera}
				selectedCount={selectedCount}
			/>
		);
	}

	// For effect tool, don't render anything - let ShapeLayer handle events
	if (currentTool === "effect") {
		return null;
	}

	// For pan tool, render interaction layer without preview
	if (currentTool === "pan") {
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
				data-active-tool={currentTool}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
			/>
		);
	}

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
			data-active-tool={currentTool}
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
						{currentTool === "rectangle" && (
							<rect
								x={Math.min(dragState.startX, dragState.currentX)}
								y={Math.min(dragState.startY, dragState.currentY)}
								width={Math.abs(dragState.currentX - dragState.startX)}
								height={Math.abs(dragState.currentY - dragState.startY)}
								fill={DEFAULT_SHAPE_STYLES.fillColor}
								stroke={DEFAULT_SHAPE_STYLES.strokeColor}
								strokeWidth={DEFAULT_SHAPE_STYLES.strokeWidth}
								opacity={DEFAULT_SHAPE_STYLES.opacity * 0.5}
							/>
						)}
						{currentTool === "ellipse" && (
							<ellipse
								cx={(dragState.startX + dragState.currentX) / 2}
								cy={(dragState.startY + dragState.currentY) / 2}
								rx={Math.abs(dragState.currentX - dragState.startX) / 2}
								ry={Math.abs(dragState.currentY - dragState.startY) / 2}
								fill={DEFAULT_SHAPE_STYLES.fillColor}
								stroke={DEFAULT_SHAPE_STYLES.strokeColor}
								strokeWidth={DEFAULT_SHAPE_STYLES.strokeWidth}
								opacity={DEFAULT_SHAPE_STYLES.opacity * 0.5}
							/>
						)}
						{currentTool === "draw" && drawPath && (
							<path
								d={drawPath}
								fill="none"
								stroke={DEFAULT_FREEDRAW_STYLES.strokeColor}
								strokeWidth={DEFAULT_FREEDRAW_STYLES.strokeWidth}
								strokeLinecap="round"
								strokeLinejoin="round"
								opacity={DEFAULT_FREEDRAW_STYLES.opacity * 0.5}
							/>
						)}
					</g>
				</svg>
			)}
		</div>
	);
};
