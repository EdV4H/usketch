import { useWhiteboardStore, whiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useRef, useState } from "react";
import type { ShapeLayerProps } from "../types";
import { Shape } from "./Shape";

export const ShapeLayer: React.FC<ShapeLayerProps> = ({
	shapes,
	camera,
	activeTool,
	className = "",
}) => {
	const shapeArray = Object.values(shapes);
	const { selectedShapeIds, selectShape, deselectShape, updateShape } = useWhiteboardStore();
	const [dragState, setDragState] = useState<{
		isDragging: boolean;
		draggedShapeId: string | null;
		startX: number;
		startY: number;
		originalX: number;
		originalY: number;
		originalPositions?: Map<string, { x: number; y: number }>;
		originalPoints?: Map<string, Array<{ x: number; y: number }>>;
	}>({ isDragging: false, draggedShapeId: null, startX: 0, startY: 0, originalX: 0, originalY: 0 });

	// State for drag selection
	const [selectionBox, setSelectionBox] = useState<{
		isSelecting: boolean;
		startX: number;
		startY: number;
		currentX: number;
		currentY: number;
		originalSelection?: Set<string>; // Store original selection for modifier key handling
	}>({ isSelecting: false, startX: 0, startY: 0, currentX: 0, currentY: 0 });

	const svgRef = useRef<SVGSVGElement>(null);

	// Track if we've moved during drag to distinguish between click and drag
	const hasDraggedRef = useRef(false);
	// Track if we've already handled the selection in pointerDown
	const selectionHandledRef = useRef(false);

	const handleShapeClick = (shapeId: string, e: React.MouseEvent) => {
		// Only handle clicks when select tool is active
		if (activeTool !== "select") return;

		// Ignore click if we just finished dragging
		if (hasDraggedRef.current) {
			hasDraggedRef.current = false;
			return;
		}

		// Ignore click if selection was already handled in pointerDown
		if (selectionHandledRef.current) {
			selectionHandledRef.current = false;
			return;
		}

		e.stopPropagation();
		if (e.shiftKey || e.metaKey) {
			// Multiple selection mode - toggle selection
			if (selectedShapeIds.has(shapeId)) {
				deselectShape(shapeId);
			} else {
				selectShape(shapeId);
			}
		} else {
			// Single selection mode - clear others and select only this shape
			const store = whiteboardStore.getState();
			store.setSelection([shapeId]);
		}
	};

	const handleShapePointerDown = useCallback(
		(shapeId: string, e: React.PointerEvent) => {
			if (activeTool !== "select") return;

			const shape = shapes[shapeId];
			if (!shape) return;

			// Stop event propagation to prevent background handler
			e.stopPropagation();

			// Check if this shape is already selected
			const isAlreadySelected = selectedShapeIds.has(shapeId);
			const hasMultipleSelected = selectedShapeIds.size > 1;

			// Handle selection based on modifier keys
			if (!isAlreadySelected) {
				const store = whiteboardStore.getState();
				if (e.shiftKey || e.metaKey) {
					// Add to selection
					store.selectShape(shapeId);
					selectionHandledRef.current = true; // Mark that we handled selection
				} else {
					// Replace selection
					store.setSelection([shapeId]);
					selectionHandledRef.current = true; // Mark that we handled selection
				}
			} else if (isAlreadySelected && (e.shiftKey || e.metaKey)) {
				// If already selected with modifier key, let click event handle deselection
				selectionHandledRef.current = false;
			} else if (isAlreadySelected && hasMultipleSelected) {
				// If already selected without modifier and multiple shapes are selected,
				// don't handle selection here - let click event handle single selection after drag check
				selectionHandledRef.current = false;
			} else {
				// If already selected and it's the only selection, just prepare for dragging
				selectionHandledRef.current = true; // Don't change selection on click
			}

			// Start dragging
			// Get the parent SVG element's bounding rect
			// For HTML shapes, currentTarget might be a div inside foreignObject
			let svgElement: SVGSVGElement | null = null;
			if (e.currentTarget instanceof SVGElement) {
				svgElement = e.currentTarget.ownerSVGElement;
			} else {
				// For HTML elements, find the closest SVG parent
				svgElement = e.currentTarget.closest("svg");
			}
			if (!svgElement) {
				// If still no SVG element, try to get it from the ref
				svgElement = svgRef.current;
			}
			if (!svgElement) return;
			const rect = svgElement.getBoundingClientRect();
			const x = (e.clientX - rect.left - camera.x) / camera.zoom;
			const y = (e.clientY - rect.top - camera.y) / camera.zoom;

			// Store original positions and points of all selected shapes for group movement
			const currentSelectedIds = whiteboardStore.getState().selectedShapeIds;
			const originalPositions = new Map<string, { x: number; y: number }>();
			const originalPoints = new Map<string, Array<{ x: number; y: number }>>();
			currentSelectedIds.forEach((id) => {
				const s = shapes[id];
				if (s) {
					originalPositions.set(id, { x: s.x, y: s.y });
					// For freedraw shapes, store initial points
					if (s.type === "freedraw" && "points" in s && s.points) {
						originalPoints.set(id, [...s.points]);
					}
				}
			});

			setDragState({
				isDragging: true,
				draggedShapeId: shapeId,
				startX: x,
				startY: y,
				originalX: shape.x,
				originalY: shape.y,
				originalPositions,
				originalPoints,
			});

			// Reset the drag flag
			hasDraggedRef.current = false;

			// Set pointer capture - for HTML elements, we need to capture on the SVG element
			if (svgElement) {
				svgElement.setPointerCapture(e.pointerId);
			} else {
				e.currentTarget.setPointerCapture(e.pointerId);
			}
			e.preventDefault();
		},
		[activeTool, selectedShapeIds, shapes, camera],
	);

	const handleShapePointerMove = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (!dragState.isDragging || !dragState.draggedShapeId) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const x = (e.clientX - rect.left - camera.x) / camera.zoom;
			const y = (e.clientY - rect.top - camera.y) / camera.zoom;

			const dx = x - dragState.startX;
			const dy = y - dragState.startY;

			// Mark that we've actually dragged (moved more than a threshold)
			if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
				hasDraggedRef.current = true;
			}

			// Get the current selected shapes
			const currentSelectedIds = whiteboardStore.getState().selectedShapeIds;

			// Move all selected shapes together
			if (currentSelectedIds.size > 1 && dragState.originalPositions) {
				// Move all selected shapes based on their original positions
				currentSelectedIds.forEach((shapeId) => {
					const originalPos = dragState.originalPositions?.get(shapeId);
					if (originalPos) {
						const updates: any = {
							x: originalPos.x + dx,
							y: originalPos.y + dy,
						};

						// For freedraw shapes, also update points
						const shape = shapes[shapeId];
						if (
							shape &&
							shape.type === "freedraw" &&
							"points" in shape &&
							dragState.originalPoints
						) {
							const originalPoints = dragState.originalPoints.get(shapeId);
							if (originalPoints) {
								updates.points = originalPoints.map((p: { x: number; y: number }) => ({
									x: p.x + dx,
									y: p.y + dy,
								}));
							}
						}

						updateShape(shapeId, updates);
					}
				});
			} else {
				// Move single shape
				const shape = shapes[dragState.draggedShapeId];
				const updates: any = {
					x: dragState.originalX + dx,
					y: dragState.originalY + dy,
				};

				// For freedraw shapes, also update points
				if (shape && shape.type === "freedraw" && "points" in shape && dragState.originalPoints) {
					const originalPoints = dragState.originalPoints.get(dragState.draggedShapeId);
					if (originalPoints) {
						updates.points = originalPoints.map((p: { x: number; y: number }) => ({
							x: p.x + dx,
							y: p.y + dy,
						}));
					}
				}

				updateShape(dragState.draggedShapeId, updates);
			}
		},
		[dragState, camera, updateShape, shapes],
	);

	const handleShapePointerUp = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (!dragState.isDragging) return;

			setDragState({
				isDragging: false,
				draggedShapeId: null,
				startX: 0,
				startY: 0,
				originalX: 0,
				originalY: 0,
			});

			// Release pointer capture from the SVG element
			if (svgRef.current) {
				svgRef.current.releasePointerCapture(e.pointerId);
			} else {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
		},
		[dragState],
	);

	// Handle background pointer events for drag selection
	const handleBackgroundPointerDown = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (activeTool !== "select") return;

			// Check if clicking on the background rect
			const target = e.target as Element;
			if (target.tagName !== "rect" || !target.hasAttribute("data-background")) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const x = (e.clientX - rect.left - camera.x) / camera.zoom;
			const y = (e.clientY - rect.top - camera.y) / camera.zoom;

			// Store original selection for modifier key handling
			const store = whiteboardStore.getState();
			const originalSelection = new Set(store.selectedShapeIds);

			setSelectionBox({
				isSelecting: true,
				startX: x,
				startY: y,
				currentX: x,
				currentY: y,
				originalSelection,
			});

			// Clear selection on background click (unless shift/cmd is held)
			if (!e.shiftKey && !e.metaKey) {
				store.clearSelection();
			}

			e.currentTarget.setPointerCapture(e.pointerId);
			e.preventDefault();
		},
		[activeTool, camera],
	);

	const handleBackgroundPointerMove = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (!selectionBox.isSelecting) return;

			const rect = e.currentTarget.getBoundingClientRect();
			const x = (e.clientX - rect.left - camera.x) / camera.zoom;
			const y = (e.clientY - rect.top - camera.y) / camera.zoom;

			setSelectionBox((prev) => ({
				...prev,
				currentX: x,
				currentY: y,
			}));

			// Calculate selection bounds in real-time
			const minX = Math.min(selectionBox.startX, x);
			const minY = Math.min(selectionBox.startY, y);
			const maxX = Math.max(selectionBox.startX, x);
			const maxY = Math.max(selectionBox.startY, y);

			// Find shapes within current selection box
			const selectedIds: string[] = [];
			Object.values(shapes).forEach((shape) => {
				const shapeWidth = "width" in shape ? shape.width : 100;
				const shapeHeight = "height" in shape ? shape.height : 100;

				// Check if shape intersects with selection box
				if (
					shape.x < maxX &&
					shape.x + shapeWidth > minX &&
					shape.y < maxY &&
					shape.y + shapeHeight > minY
				) {
					selectedIds.push(shape.id);
				}
			});

			// Update store selection in real-time
			const store = whiteboardStore.getState();
			if (e.shiftKey || e.metaKey) {
				// Add to existing selection (preserve original selection from drag start)
				const originalSelection = selectionBox.originalSelection || new Set();
				const combined = new Set([...originalSelection, ...selectedIds]);
				store.setSelection(Array.from(combined));
			} else {
				// Replace selection
				store.setSelection(selectedIds);
			}
		},
		[
			selectionBox.isSelecting,
			selectionBox.startX,
			selectionBox.startY,
			selectionBox.originalSelection,
			camera,
			shapes,
		],
	);

	const handleBackgroundPointerUp = useCallback(
		(e: React.PointerEvent<SVGSVGElement>) => {
			if (!selectionBox.isSelecting) return;

			// Selection is already updated in real-time during move
			// Just clean up the selection box state
			setSelectionBox({
				isSelecting: false,
				startX: 0,
				startY: 0,
				currentX: 0,
				currentY: 0,
			});

			e.currentTarget.releasePointerCapture(e.pointerId);
		},
		[selectionBox.isSelecting],
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
				cursor: dragState.isDragging
					? "grabbing"
					: selectionBox.isSelecting
						? "crosshair"
						: "default",
			}}
			onPointerDown={handleBackgroundPointerDown}
			onPointerMove={(e) => {
				handleShapePointerMove(e);
				handleBackgroundPointerMove(e);
			}}
			onPointerUp={(e) => {
				handleShapePointerUp(e);
				handleBackgroundPointerUp(e);
			}}
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
						onClick={(e) => handleShapeClick(shape.id, e)}
						onPointerDown={(e) => handleShapePointerDown(shape.id, e)}
					/>
				))}

				{/* Render selection box */}
				{selectionBox.isSelecting && (
					<rect
						x={Math.min(selectionBox.startX, selectionBox.currentX)}
						y={Math.min(selectionBox.startY, selectionBox.currentY)}
						width={Math.abs(selectionBox.currentX - selectionBox.startX)}
						height={Math.abs(selectionBox.currentY - selectionBox.startY)}
						fill="rgba(0, 122, 255, 0.1)"
						stroke="#007AFF"
						strokeWidth={1}
						strokeDasharray="5,5"
						pointerEvents="none"
					/>
				)}
			</g>
		</svg>
	);
};
