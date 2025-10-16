import { globalShapeRegistry as ShapeRegistry } from "@usketch/shape-registry";
import type React from "react";
import { useCallback, useMemo, useRef } from "react";
import { useToolManager } from "../hooks/use-tool-manager";
import type { SelectionLayerProps } from "../types";

export const SelectionLayer: React.FC<SelectionLayerProps> = ({
	selectedIds,
	shapes,
	camera,
	className = "",
}) => {
	const { toolManager } = useToolManager();
	const containerRef = useRef<HTMLDivElement>(null);
	const selectedShapes = useMemo(() => {
		return Array.from(selectedIds)
			.map((id) => shapes[id])
			.filter(Boolean);
	}, [selectedIds, shapes]);

	// Helper function to convert screen coordinates to canvas coordinates
	const screenToCanvas = useCallback(
		(clientX: number, clientY: number) => {
			// Use parent container's bounding rect for more reliable positioning
			const canvasContainer = containerRef.current?.parentElement;
			if (!canvasContainer) return { x: 0, y: 0 };

			const rect = canvasContainer.getBoundingClientRect();
			return {
				x: (clientX - rect.left - camera.x) / camera.zoom,
				y: (clientY - rect.top - camera.y) / camera.zoom,
			};
		},
		[camera.x, camera.y, camera.zoom],
	);

	// Handle resize handle pointer down
	const handleResizePointerDown = useCallback(
		(e: React.PointerEvent, handle: string) => {
			if (!toolManager) return;

			// Check if click is on foreignObject interactive element (e.g., buttons)
			const target = e.target as HTMLElement;
			if (target.closest('[data-interactive="true"]') || target.closest("button")) {
				// Let the interactive element handle the event
				return;
			}

			e.stopPropagation();
			e.preventDefault();

			const point = screenToCanvas(e.clientX, e.clientY);

			// Create a custom PointerEvent with resizeHandle field
			const customEvent = new PointerEvent(e.type, e.nativeEvent);
			// Add resizeHandle to the event object
			Object.defineProperty(customEvent, "resizeHandle", {
				value: handle,
				writable: false,
				enumerable: true,
			});

			// Send event to ToolManager
			toolManager.handlePointerDown(customEvent, point);

			// Capture pointer for drag tracking on the element itself
			const element = e.currentTarget as HTMLElement;
			element.setPointerCapture(e.pointerId);

			// Add move and up handlers to the element that captured the pointer
			const handleMove = (moveEvent: PointerEvent) => {
				const movePoint = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
				toolManager.handlePointerMove(moveEvent, movePoint);
			};

			const handleUp = (upEvent: PointerEvent) => {
				const upPoint = screenToCanvas(upEvent.clientX, upEvent.clientY);
				toolManager.handlePointerUp(upEvent, upPoint);

				// Clean up event listeners
				element.removeEventListener("pointermove", handleMove);
				element.removeEventListener("pointerup", handleUp);
				element.releasePointerCapture(upEvent.pointerId);
			};

			// Add event listeners to the element
			element.addEventListener("pointermove", handleMove);
			element.addEventListener("pointerup", handleUp);
		},
		[screenToCanvas, toolManager],
	);

	const boundingBox = useMemo(() => {
		if (selectedShapes.length === 0) return null;

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		selectedShapes.forEach((shape) => {
			// Try to get bounds from plugin, fall back to shape dimensions
			const plugin = ShapeRegistry.getPlugin(shape.type);
			let bounds = {
				x: shape.x,
				y: shape.y,
				width: "width" in shape ? shape.width : 100,
				height: "height" in shape ? shape.height : 100,
			};

			if (plugin?.getBounds) {
				bounds = plugin.getBounds(shape);
			}

			minX = Math.min(minX, bounds.x);
			minY = Math.min(minY, bounds.y);
			maxX = Math.max(maxX, bounds.x + bounds.width);
			maxY = Math.max(maxY, bounds.y + bounds.height);
		});

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}, [selectedShapes]);

	if (!boundingBox) return null;

	const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;

	return (
		<div
			ref={containerRef}
			className={`selection-layer ${className}`.trim()}
			style={{
				position: "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				transform,
				transformOrigin: "0 0",
			}}
		>
			{/* Show group bounding box for multiple selection */}
			{selectedShapes.length > 1 ? (
				<div
					className="selection-box group-selection"
					data-testid="group-selection-box"
					style={{
						position: "absolute",
						left: boundingBox.x - 2,
						top: boundingBox.y - 2,
						width: boundingBox.width + 4,
						height: boundingBox.height + 4,
						border: "2px solid #0066ff",
						backgroundColor: "rgba(0, 102, 255, 0.05)",
						pointerEvents: "none",
					}}
				/>
			) : (
				/* Show individual selection boxes */
				selectedShapes.map((shape) => {
					// Try to get bounds from plugin, fall back to shape dimensions
					const plugin = ShapeRegistry.getPlugin(shape.type);
					let bounds = {
						x: shape.x,
						y: shape.y,
						width: "width" in shape ? shape.width : 100,
						height: "height" in shape ? shape.height : 100,
					};

					if (plugin?.getBounds) {
						bounds = plugin.getBounds(shape);
					}

					return (
						<div
							key={shape.id}
							className="selection-box"
							data-testid={`selection-box-${shape.id}`}
							style={{
								position: "absolute",
								left: bounds.x - 2,
								top: bounds.y - 2,
								width: bounds.width + 4,
								height: bounds.height + 4,
								border: "2px solid #0066ff",
								backgroundColor: "rgba(0, 102, 255, 0.1)",
								pointerEvents: "none",
							}}
						/>
					);
				})
			)}
			{/* Show resize handles for single selection */}
			{selectedShapes.length === 1 && (
				<>
					{/* Invisible edge resize areas (full edge length) */}
					{/* Top edge */}
					<div
						className="resize-edge n"
						data-resize-handle="n"
						data-testid="resize-edge-n"
						style={{
							position: "absolute",
							left: boundingBox.x + 10,
							top: boundingBox.y - 5,
							width: boundingBox.width - 20,
							height: 10,
							cursor: "n-resize",
							pointerEvents: "auto",
							zIndex: 9,
							background: "transparent",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "n")}
					/>
					{/* Right edge */}
					<div
						className="resize-edge e"
						data-resize-handle="e"
						data-testid="resize-edge-e"
						style={{
							position: "absolute",
							left: boundingBox.x + boundingBox.width - 5,
							top: boundingBox.y + 10,
							width: 10,
							height: boundingBox.height - 20,
							cursor: "e-resize",
							pointerEvents: "auto",
							zIndex: 9,
							background: "transparent",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "e")}
					/>
					{/* Bottom edge */}
					<div
						className="resize-edge s"
						data-resize-handle="s"
						data-testid="resize-edge-s"
						style={{
							position: "absolute",
							left: boundingBox.x + 10,
							top: boundingBox.y + boundingBox.height - 5,
							width: boundingBox.width - 20,
							height: 10,
							cursor: "s-resize",
							pointerEvents: "auto",
							zIndex: 9,
							background: "transparent",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "s")}
					/>
					{/* Left edge */}
					<div
						className="resize-edge w"
						data-resize-handle="w"
						data-testid="resize-edge-w"
						style={{
							position: "absolute",
							left: boundingBox.x - 5,
							top: boundingBox.y + 10,
							width: 10,
							height: boundingBox.height - 20,
							cursor: "w-resize",
							pointerEvents: "auto",
							zIndex: 9,
							background: "transparent",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "w")}
					/>

					{/* Corner handles with larger interaction area */}
					<div
						className="resize-handle nw"
						data-resize-handle="nw"
						data-testid="resize-handle-nw"
						style={{
							position: "absolute",
							left: boundingBox.x - 10,
							top: boundingBox.y - 10,
							width: 20,
							height: 20,
							cursor: "nw-resize",
							pointerEvents: "auto",
							zIndex: 10,
							// Invisible expanded hit area
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "nw")}
					>
						{/* Visible handle */}
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
					<div
						className="resize-handle ne"
						data-resize-handle="ne"
						data-testid="resize-handle-ne"
						style={{
							position: "absolute",
							left: boundingBox.x + boundingBox.width - 10,
							top: boundingBox.y - 10,
							width: 20,
							height: 20,
							cursor: "ne-resize",
							pointerEvents: "auto",
							zIndex: 10,
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "ne")}
					>
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
					<div
						className="resize-handle sw"
						data-resize-handle="sw"
						data-testid="resize-handle-sw"
						style={{
							position: "absolute",
							left: boundingBox.x - 10,
							top: boundingBox.y + boundingBox.height - 10,
							width: 20,
							height: 20,
							cursor: "sw-resize",
							pointerEvents: "auto",
							zIndex: 10,
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "sw")}
					>
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
					<div
						className="resize-handle se"
						data-resize-handle="se"
						data-testid="resize-handle-se"
						style={{
							position: "absolute",
							left: boundingBox.x + boundingBox.width - 10,
							top: boundingBox.y + boundingBox.height - 10,
							width: 20,
							height: 20,
							cursor: "se-resize",
							pointerEvents: "auto",
							zIndex: 10,
							background: "transparent",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
						onPointerDown={(e) => handleResizePointerDown(e, "se")}
					>
						<div
							style={{
								width: 8,
								height: 8,
								backgroundColor: "#0066ff",
								border: "1px solid white",
								borderRadius: "2px",
								pointerEvents: "none",
							}}
						/>
					</div>
				</>
			)}
		</div>
	);
};
