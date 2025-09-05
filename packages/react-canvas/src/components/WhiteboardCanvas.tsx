import { ShapeRegistryProvider } from "@usketch/shape-registry";
import { useWhiteboardStore } from "@usketch/store";
import type React from "react";
import { useEffect, useRef } from "react";
import { useCanvas } from "../hooks/useCanvas";
import { useInteraction } from "../hooks/useInteraction";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import type { CanvasProps } from "../types";
import { BackgroundLayer } from "./BackgroundLayer";
import { InteractionLayer } from "./InteractionLayer";
import { SelectionLayer } from "./SelectionLayer";
import { ShapeLayer } from "./ShapeLayer";

// Internal canvas component that uses the registry
const WhiteboardCanvasInternal: React.FC<Omit<CanvasProps, "shapes">> = ({
	className = "",
	background,
	onReady,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const { shapes, camera, selectedShapeIds } = useWhiteboardStore();
	const canvasManager = useCanvas();
	const interactions = useInteraction();

	useKeyboardShortcuts();

	useEffect(() => {
		if (onReady && canvasManager) {
			onReady(canvasManager);
		}
	}, [onReady, canvasManager]);

	return (
		<div
			ref={containerRef}
			className={`whiteboard-canvas ${className}`.trim()}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				cursor: interactions.cursor,
			}}
			{...interactions.getCanvasProps()}
		>
			<BackgroundLayer camera={camera} options={background} />
			<ShapeLayer shapes={shapes} camera={camera} activeTool={interactions.activeTool} />
			<SelectionLayer selectedIds={selectedShapeIds} shapes={shapes} camera={camera} />
			<InteractionLayer camera={camera} activeTool={interactions.activeTool} />
		</div>
	);
};

// Public component that optionally sets up ShapeRegistryProvider
export const WhiteboardCanvas: React.FC<CanvasProps> = ({ shapes, ...props }) => {
	// If shapes are provided, wrap with ShapeRegistryProvider
	if (shapes && shapes.length > 0) {
		return (
			<ShapeRegistryProvider plugins={shapes}>
				<WhiteboardCanvasInternal {...props} />
			</ShapeRegistryProvider>
		);
	}

	// Otherwise, render directly (assuming parent provides ShapeRegistryProvider)
	return <WhiteboardCanvasInternal {...props} />;
};
