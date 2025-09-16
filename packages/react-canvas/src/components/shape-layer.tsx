import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useRef } from "react";
import { useToolMachine } from "../hooks/use-tool-machine";
import type { ShapeLayerProps } from "../types";
import { Shape } from "./shape";

export const ShapeLayer: React.FC<ShapeLayerProps> = ({
	shapes,
	camera,
	activeTool,
	className = "",
}) => {
	const shapeArray = Object.values(shapes);
	const { selectedShapeIds } = useWhiteboardStore();
	const toolMachine = useToolMachine();
	const svgRef = useRef<SVGSVGElement>(null);

	// Helper function to convert screen coordinates to canvas coordinates
	const screenToCanvas = useCallback(
		(clientX: number, clientY: number) => {
			if (!svgRef.current) return { x: 0, y: 0 };
			const rect = svgRef.current.getBoundingClientRect();
			return {
				x: (clientX - rect.left - camera.x) / camera.zoom,
				y: (clientY - rect.top - camera.y) / camera.zoom,
			};
		},
		[camera.x, camera.y, camera.zoom],
	);

	const handleShapePointerDown = useCallback(
		(shapeId: string, e: React.PointerEvent) => {
			if (activeTool !== "select") return;

			e.stopPropagation(); // Prevent background handler
			const point = screenToCanvas(e.clientX, e.clientY);

			// Get shape at point to pass to XState
			const shape = shapes[shapeId];
			if (!shape) return;

			// Send event to XState with shape context
			toolMachine.handlePointerDown({ ...point, shapeId }, e);

			// Capture pointer for drag tracking
			if (svgRef.current) {
				svgRef.current.setPointerCapture(e.pointerId);
			}
		},
		[activeTool, shapes, screenToCanvas, toolMachine],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (activeTool !== "select") return;

			const point = screenToCanvas(e.clientX, e.clientY);
			toolMachine.handlePointerMove(point, e);
		},
		[activeTool, screenToCanvas, toolMachine],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (activeTool !== "select") return;

			const point = screenToCanvas(e.clientX, e.clientY);
			toolMachine.handlePointerUp(point, e);

			// Release pointer capture
			if (svgRef.current) {
				svgRef.current.releasePointerCapture(e.pointerId);
			}
		},
		[activeTool, screenToCanvas, toolMachine],
	);

	// Handle background pointer events for drag selection
	const handleBackgroundPointerDown = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (activeTool !== "select") return;

			// Check if clicking on the background rect
			const target = e.target as Element;
			if (target.tagName !== "rect" || !target.hasAttribute("data-background")) return;

			// Don't handle if already handled by WhiteboardCanvas
			e.stopPropagation();
			const point = screenToCanvas(e.clientX, e.clientY);

			// Send pointer down event to XState machine (it handles selection clearing/brush)
			toolMachine.handlePointerDown(point, e);

			// Capture pointer for drag tracking
			if (svgRef.current) {
				svgRef.current.setPointerCapture(e.pointerId);
			}
			e.preventDefault();
		},
		[activeTool, screenToCanvas, toolMachine],
	);

	return (
		<svg
			ref={svgRef}
			className={`shape-layer ${className}`.trim()}
			data-testid="shape-layer"
			role="img"
			aria-label="Shape layer"
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
				cursor: "default", // Let XState control cursor
				pointerEvents: "all", // Ensure SVG receives events
			}}
			onPointerDown={handleBackgroundPointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		>
			<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
				{/* Invisible background rect for capturing pointer events */}
				<rect
					data-background="true"
					x={-10000}
					y={-10000}
					width={20000}
					height={20000}
					fill="transparent"
					style={{ pointerEvents: "fill" }}
				/>

				{/* Render shapes */}
				{shapeArray.map((shape) => (
					<Shape
						key={shape.id}
						shape={shape}
						isSelected={selectedShapeIds.has(shape.id)}
						onPointerDown={(e) => handleShapePointerDown(shape.id, e)}
					/>
				))}
			</g>
		</svg>
	);
};
