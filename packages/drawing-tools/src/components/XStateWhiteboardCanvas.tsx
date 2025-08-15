import { whiteboardStore } from "@usketch/store";
import type React from "react";
import { useEffect, useRef } from "react";
import { useToolMachine } from "../hooks";

interface XStateWhiteboardCanvasProps {
	className?: string;
	width?: number;
	height?: number;
}

export const XStateWhiteboardCanvas: React.FC<XStateWhiteboardCanvasProps> = ({
	className,
	width = 800,
	height = 600,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const overlayRef = useRef<HTMLDivElement>(null);

	const { handlers, toolContext, currentToolId, isActive } = useToolMachine();

	// Attach event handlers to the overlay
	useEffect(() => {
		const overlay = overlayRef.current;
		if (!overlay) return;

		// Pointer events
		overlay.addEventListener("pointerdown", handlers.onPointerDown);
		overlay.addEventListener("pointermove", handlers.onPointerMove);
		overlay.addEventListener("pointerup", handlers.onPointerUp);

		// Mouse events
		overlay.addEventListener("dblclick", handlers.onDoubleClick);
		overlay.addEventListener("wheel", handlers.onWheel);

		// Keyboard events (on document level)
		document.addEventListener("keydown", handlers.onKeyDown);
		document.addEventListener("keyup", handlers.onKeyUp);

		return () => {
			overlay.removeEventListener("pointerdown", handlers.onPointerDown);
			overlay.removeEventListener("pointermove", handlers.onPointerMove);
			overlay.removeEventListener("pointerup", handlers.onPointerUp);
			overlay.removeEventListener("dblclick", handlers.onDoubleClick);
			overlay.removeEventListener("wheel", handlers.onWheel);
			document.removeEventListener("keydown", handlers.onKeyDown);
			document.removeEventListener("keyup", handlers.onKeyUp);
		};
	}, [handlers]);

	// Update cursor based on tool context
	useEffect(() => {
		const overlay = overlayRef.current;
		if (!overlay || !toolContext) return;

		overlay.style.cursor = toolContext.cursor || "default";
	}, [toolContext?.cursor]);

	// Render shapes from store
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const renderShapes = () => {
			// Clear canvas
			ctx.clearRect(0, 0, width, height);

			// Get shapes from store
			const state = whiteboardStore.getState();
			const shapes = Object.values(state.shapes);

			// Render each shape
			shapes.forEach((shape) => {
				ctx.save();

				if (shape.type === "path" && shape.points) {
					// Draw path
					ctx.beginPath();
					ctx.strokeStyle = shape.style?.stroke || "#000000";
					ctx.lineWidth = shape.style?.strokeWidth || 2;
					ctx.globalAlpha = shape.style?.opacity || 1;

					shape.points.forEach((point, index) => {
						if (index === 0) {
							ctx.moveTo(point.x, point.y);
						} else {
							ctx.lineTo(point.x, point.y);
						}
					});

					ctx.stroke();
				} else if (shape.type === "rectangle") {
					// Draw rectangle
					ctx.strokeStyle = shape.style?.stroke || "#000000";
					ctx.lineWidth = shape.style?.strokeWidth || 2;
					ctx.globalAlpha = shape.style?.opacity || 1;

					if (shape.style?.fill && shape.style.fill !== "none") {
						ctx.fillStyle = shape.style.fill;
						ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
					}

					ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
				}

				// Highlight selected shapes
				if (state.selectedShapeIds.has(shape.id)) {
					ctx.strokeStyle = "#0066ff";
					ctx.lineWidth = 2;
					ctx.setLineDash([5, 5]);
					ctx.strokeRect(shape.x - 2, shape.y - 2, shape.width + 4, shape.height + 4);
					ctx.setLineDash([]);
				}

				ctx.restore();
			});

			// Render current drawing stroke if any
			if (toolContext?.currentStroke && toolContext.currentStroke.length > 0) {
				ctx.save();
				ctx.beginPath();
				ctx.strokeStyle = toolContext.strokeStyle?.color || "#000000";
				ctx.lineWidth = toolContext.strokeStyle?.width || 2;
				ctx.globalAlpha = toolContext.strokeStyle?.opacity || 1;
				ctx.setLineDash([2, 2]);

				toolContext.currentStroke.forEach((point, index) => {
					if (index === 0) {
						ctx.moveTo(point.x, point.y);
					} else {
						ctx.lineTo(point.x, point.y);
					}
				});

				ctx.stroke();
				ctx.restore();
			}

			// Render selection box if any
			if (toolContext?.selectionBox) {
				ctx.save();
				ctx.strokeStyle = "#0066ff";
				ctx.lineWidth = 1;
				ctx.setLineDash([5, 5]);
				ctx.fillStyle = "rgba(0, 102, 255, 0.1)";

				const box = toolContext.selectionBox;
				ctx.fillRect(box.x, box.y, box.width, box.height);
				ctx.strokeRect(box.x, box.y, box.width, box.height);

				ctx.restore();
			}
		};

		// Subscribe to store changes
		const unsubscribe = whiteboardStore.subscribe(renderShapes);

		// Initial render
		renderShapes();

		return unsubscribe;
	}, [width, height, toolContext]);

	return (
		<div className={`xstate-whiteboard-canvas ${className || ""}`}>
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				style={{
					border: "1px solid #ccc",
					backgroundColor: "#fff",
					position: "absolute",
				}}
			/>
			<div
				ref={overlayRef}
				style={{
					position: "absolute",
					width,
					height,
					pointerEvents: "all",
				}}
			/>

			{/* Tool status overlay */}
			<div
				className="tool-status"
				style={{
					position: "absolute",
					bottom: 10,
					left: 10,
					padding: "5px 10px",
					backgroundColor: "rgba(0, 0, 0, 0.7)",
					color: "white",
					fontSize: "12px",
					borderRadius: "4px",
				}}
			>
				Tool: {currentToolId || "None"} | {isActive ? "Active" : "Idle"}
			</div>
		</div>
	);
};

export default XStateWhiteboardCanvas;
