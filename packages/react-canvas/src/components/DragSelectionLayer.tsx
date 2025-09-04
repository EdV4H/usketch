import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useState } from "react";

interface DragState {
	startX: number;
	startY: number;
	currentX: number;
	currentY: number;
	isDragging: boolean;
}

interface DragSelectionLayerProps {
	camera: { x: number; y: number; zoom: number };
	activeTool: string;
}

export const DragSelectionLayer: React.FC<DragSelectionLayerProps> = ({ camera, activeTool }) => {
	const [dragState, setDragState] = useState<DragState>({
		startX: 0,
		startY: 0,
		currentX: 0,
		currentY: 0,
		isDragging: false,
	});

	const { clearSelection, shapes, selectShapesInArea } = useWhiteboardStore();

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
			if (activeTool !== "select") return;

			// Check if clicking on a shape
			const target = e.target as HTMLElement;
			if (target.closest("[data-shape-id]")) {
				return; // Let ShapeLayer handle it
			}

			const rect = e.currentTarget.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const { x, y } = screenToCanvas(screenX, screenY);

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

			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[activeTool, screenToCanvas, clearSelection],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!dragState.isDragging || activeTool !== "select") return;

			const rect = e.currentTarget.getBoundingClientRect();
			const screenX = e.clientX - rect.left;
			const screenY = e.clientY - rect.top;
			const { x, y } = screenToCanvas(screenX, screenY);

			setDragState((prev) => ({
				...prev,
				currentX: x,
				currentY: y,
			}));
		},
		[dragState.isDragging, activeTool, screenToCanvas],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			if (!dragState.isDragging || activeTool !== "select") return;

			// Select shapes within the drag area
			const minX = Math.min(dragState.startX, dragState.currentX);
			const minY = Math.min(dragState.startY, dragState.currentY);
			const maxX = Math.max(dragState.startX, dragState.currentX);
			const maxY = Math.max(dragState.startY, dragState.currentY);

			// Find shapes in the selection area
			const selectedIds: string[] = [];
			Object.values(shapes).forEach((shape) => {
				// Simple bounding box check
				if (
					shape.x < maxX &&
					shape.x + shape.width > minX &&
					shape.y < maxY &&
					shape.y + shape.height > minY
				) {
					selectedIds.push(shape.id);
				}
			});

			if (selectedIds.length > 0) {
				selectShapesInArea(selectedIds);
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
		[dragState, activeTool, shapes, selectShapesInArea],
	);

	if (activeTool !== "select") {
		return null;
	}

	return (
		<div
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "auto",
			}}
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
					aria-label="Drag selection area"
				>
					<title>Drag selection area</title>
					<g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
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
					</g>
				</svg>
			)}
		</div>
	);
};
