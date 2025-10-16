import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useCallback, useEffect } from "react";
import { useSelectionIndicator } from "../hooks/use-selection-indicator";
import { useToolManager } from "../hooks/use-tool-manager";
import type { InteractionLayerProps } from "../types";
import { DefaultSelectionIndicator } from "./default-selection-indicator";

/**
 * InteractionLayer - ToolManager integrated version
 * Uses XState-based ToolManager for all tool interactions
 */
export const InteractionLayer: React.FC<InteractionLayerProps> = ({
	camera,
	currentTool,
	selectionIndicator,
	selectionIndicatorClassName: _selectionIndicatorClassName,
	selectionIndicatorStyle: _selectionIndicatorStyle,
	className = "",
}) => {
	const { setCurrentTool } = useWhiteboardStore();
	const toolManager = useToolManager();

	// Selection indicator state from hook
	const { bounds, visible, selectedCount } = useSelectionIndicator(currentTool);

	// Use custom indicator or default
	const SelectionIndicatorComponent = selectionIndicator || DefaultSelectionIndicator;

	const handlePointerDown = useCallback(
		(e: React.PointerEvent) => {
			// Check if click is on foreignObject (HTML interactive elements)
			const target = e.target as HTMLElement;
			if (target.closest("foreignObject")) {
				// Let the foreignObject handle the event
				return;
			}

			// Convert to PointerEvent for ToolManager
			const nativeEvent = e.nativeEvent;
			toolManager.handlePointerDown(nativeEvent, camera);

			e.currentTarget.setPointerCapture(e.pointerId);
		},
		[toolManager, camera],
	);

	const handlePointerMove = useCallback(
		(e: React.PointerEvent) => {
			// Check if pointer is on foreignObject
			const target = e.target as HTMLElement;
			if (target.closest("foreignObject")) {
				return;
			}

			const nativeEvent = e.nativeEvent;
			toolManager.handlePointerMove(nativeEvent, camera);
		},
		[toolManager, camera],
	);

	const handlePointerUp = useCallback(
		(e: React.PointerEvent) => {
			// Check if pointer is on foreignObject
			const target = e.target as HTMLElement;
			if (target.closest("foreignObject")) {
				return;
			}

			const nativeEvent = e.nativeEvent;
			toolManager.handlePointerUp(nativeEvent, camera);

			e.currentTarget.releasePointerCapture(e.pointerId);
		},
		[toolManager, camera],
	);

	// Handle escape key to cancel drawing
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				toolManager.handleKeyDown(e);
				// Switch back to select tool
				setCurrentTool("select");
			} else {
				toolManager.handleKeyDown(e);
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			toolManager.handleKeyUp(e);
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [toolManager, setCurrentTool]);

	const getCursor = () => {
		switch (currentTool) {
			case "select":
				return "default";
			case "pan":
				return "grab";
			case "rectangle":
			case "ellipse":
			case "draw":
				// NOTE: "effect" case removed - tool temporarily disabled (Issue #152)
				return "crosshair";
			default:
				return "default";
		}
	};

	// Get preview shape from ToolManager
	const previewShape = toolManager.getPreviewShape();

	// Render selection indicator for select tool
	if (currentTool === "select") {
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
				<SelectionIndicatorComponent
					bounds={bounds}
					visible={visible}
					camera={camera}
					selectedCount={selectedCount}
				/>
			</div>
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
			{previewShape && (
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
						{previewShape.type === "rectangle" && (
							<rect
								x={previewShape.x}
								y={previewShape.y}
								width={previewShape.width}
								height={previewShape.height}
								fill={previewShape.fillColor}
								stroke={previewShape.strokeColor}
								strokeWidth={previewShape.strokeWidth}
								opacity={previewShape.opacity}
							/>
						)}
						{previewShape.type === "ellipse" && (
							<ellipse
								cx={previewShape.x + previewShape.width / 2}
								cy={previewShape.y + previewShape.height / 2}
								rx={previewShape.width / 2}
								ry={previewShape.height / 2}
								fill={previewShape.fillColor}
								stroke={previewShape.strokeColor}
								strokeWidth={previewShape.strokeWidth}
								opacity={previewShape.opacity}
							/>
						)}
						{previewShape.type === "freedraw" && previewShape.path && (
							<path
								d={previewShape.path}
								fill="none"
								stroke={previewShape.strokeColor}
								strokeWidth={previewShape.strokeWidth}
								strokeLinecap="round"
								strokeLinejoin="round"
								opacity={previewShape.opacity}
							/>
						)}
					</g>
				</svg>
			)}
		</div>
	);
};
